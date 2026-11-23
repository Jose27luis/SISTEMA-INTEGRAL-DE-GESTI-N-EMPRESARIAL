import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Usuario } from '@prisma/client';
import type {
  InicioSesion,
  RespuestaInicioSesion,
  SesionIniciada,
  VerificacionMfa,
} from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aIso, horaEnLima, sumarMinutos } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { actorAnonimo, actorDesde, AuditoriaService } from '../audit/audit.service';
import { estaBloqueado, registrarIntentoFallido } from '../security/login-attempts';
import { HashContrasenas } from '../security/password-hasher.service';
import { CifradorSecretos } from '../security/secret-cipher.service';
import { resumirSecreto } from '../security/tokens';
import { verificarCodigoTotp } from '../security/totp';
import { SesionesService } from './sessions.service';

const MENSAJE_CREDENCIALES = 'Correo o contraseña incorrectos.';
const MINUTOS_DESAFIO_MFA = 5;
const MAXIMO_INTENTOS_DESAFIO = 5;
const PATRON_CODIGO_TOTP = /^\d{6}$/;

type MetodoVerificacion = 'TOTP' | 'CODIGO_RECUPERACION';

@Injectable()
export class IngresoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hash: HashContrasenas,
    private readonly cifrador: CifradorSecretos,
    private readonly sesiones: SesionesService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async iniciar(datos: InicioSesion, cliente: ContextoCliente): Promise<RespuestaInicioSesion> {
    const ahora = new Date();
    const usuario = await this.prisma.usuario.findUnique({ where: { correo: datos.correo } });

    if (usuario === null || !usuario.activo) {
      await this.hash.simularVerificacion(datos.contrasena);
      await this.registrarFallo(
        cliente,
        usuario?.id ?? null,
        usuario === null ? 'Correo no registrado' : 'Usuario desactivado',
      );
      throw new UnauthorizedException({ mensaje: MENSAJE_CREDENCIALES, errores: [] });
    }

    if (estaBloqueado(usuario, ahora) && usuario.bloqueadoHasta !== null) {
      await this.registrarFallo(cliente, usuario.id, 'Intento durante bloqueo temporal');
      throw new HttpException(
        {
          mensaje: `Su cuenta está bloqueada temporalmente por intentos fallidos. Intente nuevamente después de las ${horaEnLima(usuario.bloqueadoHasta)} (hora de Lima).`,
          errores: [],
        },
        HttpStatus.LOCKED,
      );
    }

    if (!(await this.hash.verificar(usuario.hashContrasena, datos.contrasena))) {
      const estado = registrarIntentoFallido(usuario, ahora);
      await this.prisma.usuario.update({ where: { id: usuario.id }, data: estado });
      await this.registrarFallo(
        cliente,
        usuario.id,
        estado.bloqueadoHasta === null ? 'Contraseña incorrecta' : 'Contraseña incorrecta; cuenta bloqueada',
      );
      throw new UnauthorizedException({ mensaje: MENSAJE_CREDENCIALES, errores: [] });
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { intentosFallidos: 0, bloqueadoHasta: null },
    });

    if (usuario.mfaActivo) {
      const desafio = await this.prisma.desafioMfa.create({
        data: { usuarioId: usuario.id, expiraEn: sumarMinutos(ahora, MINUTOS_DESAFIO_MFA) },
      });

      return { estado: 'MFA_REQUERIDO', desafioId: desafio.id };
    }

    return this.abrirSesion(usuario, cliente, null);
  }

  async verificarMfa(datos: VerificacionMfa, cliente: ContextoCliente): Promise<SesionIniciada> {
    const ahora = new Date();
    const desafio = await this.prisma.desafioMfa.findUnique({
      where: { id: datos.desafioId },
      include: { usuario: true },
    });

    if (
      desafio === null ||
      desafio.usadoEn !== null ||
      desafio.expiraEn.getTime() <= ahora.getTime() ||
      desafio.intentos >= MAXIMO_INTENTOS_DESAFIO ||
      !desafio.usuario.activo ||
      !desafio.usuario.mfaActivo ||
      desafio.usuario.mfaSecretoCifrado === null
    ) {
      throw new UnauthorizedException({
        mensaje: 'La verificación expiró o ya no es válida. Inicie sesión nuevamente.',
        errores: [],
      });
    }

    const metodo = await this.validarCodigo(
      desafio.usuario.id,
      desafio.usuario.mfaSecretoCifrado,
      datos.codigo,
    );

    if (metodo === null) {
      await this.prisma.desafioMfa.update({
        where: { id: desafio.id },
        data: { intentos: { increment: 1 } },
      });
      await this.registrarFallo(cliente, desafio.usuario.id, 'Código de verificación incorrecto');
      throw new UnauthorizedException({
        mensaje: 'El código de verificación es incorrecto.',
        errores: [{ campo: 'codigo', mensaje: 'Revise el código e intente nuevamente.' }],
      });
    }

    return this.abrirSesion(desafio.usuario, cliente, { desafioId: desafio.id, metodo, codigo: datos.codigo });
  }

  async salir(usuario: UsuarioAutenticado, cliente: ContextoCliente): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.sesiones.revocarPropia(usuario.sesionId, usuario.usuarioId, 'Cierre de sesión', tx);
      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, cliente),
          accion: 'SALIR',
          entidad: 'sesion',
          entidadId: usuario.sesionId,
        },
        tx,
      );
    });
  }

  private async validarCodigo(
    usuarioId: string,
    secretoCifrado: string,
    codigo: string,
  ): Promise<MetodoVerificacion | null> {
    if (PATRON_CODIGO_TOTP.test(codigo)) {
      return verificarCodigoTotp(this.cifrador.descifrar(secretoCifrado), codigo) ? 'TOTP' : null;
    }

    const recuperacion = await this.prisma.codigoRecuperacion.findFirst({
      where: { usuarioId, hashCodigo: resumirSecreto(codigo), usadoEn: null, invalidadoEn: null },
    });

    return recuperacion === null ? null : 'CODIGO_RECUPERACION';
  }

  private async abrirSesion(
    usuario: Usuario,
    cliente: ContextoCliente,
    verificacion: { desafioId: string; metodo: MetodoVerificacion; codigo: string } | null,
  ): Promise<SesionIniciada> {
    const ahora = new Date();

    const creada = await this.prisma.$transaction(async (tx) => {
      if (verificacion !== null) {
        const consumo = await tx.desafioMfa.updateMany({
          where: { id: verificacion.desafioId, usadoEn: null },
          data: { usadoEn: ahora },
        });

        if (consumo.count === 0) {
          throw new UnauthorizedException({
            mensaje: 'La verificación ya fue utilizada. Inicie sesión nuevamente.',
            errores: [],
          });
        }

        if (verificacion.metodo === 'CODIGO_RECUPERACION') {
          const uso = await tx.codigoRecuperacion.updateMany({
            where: {
              usuarioId: usuario.id,
              hashCodigo: resumirSecreto(verificacion.codigo),
              usadoEn: null,
              invalidadoEn: null,
            },
            data: { usadoEn: ahora },
          });

          if (uso.count === 0) {
            throw new UnauthorizedException({
              mensaje: 'El código de recuperación ya fue utilizado.',
              errores: [{ campo: 'codigo', mensaje: 'Use otro código de recuperación.' }],
            });
          }
        }
      }

      const sesion = await this.sesiones.crear(usuario.id, cliente, tx);

      await tx.usuario.update({ where: { id: usuario.id }, data: { ultimoIngreso: ahora } });
      await this.auditoria.registrar(
        {
          actor: { usuarioId: usuario.id, sesionId: sesion.sesionId, ip: cliente.ip },
          accion: 'INGRESAR',
          entidad: 'sesion',
          entidadId: sesion.sesionId,
          despues: {
            verificacion: verificacion?.metodo ?? 'SOLO_CONTRASENA',
            agenteUsuario: cliente.agenteUsuario,
          },
        },
        tx,
      );

      return sesion;
    });

    return { estado: 'SESION_INICIADA', token: creada.token, expiraEn: aIso(creada.expiraEn) };
  }

  private async registrarFallo(
    cliente: ContextoCliente,
    usuarioId: string | null,
    motivo: string,
  ): Promise<void> {
    await this.auditoria.registrar({
      actor: { ...actorAnonimo(cliente), usuarioId },
      accion: 'INGRESO_FALLIDO',
      entidad: 'usuario',
      entidadId: usuarioId,
      motivo,
    });
  }
}
