import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { CodigosRecuperacion, ConfiguracionMfa } from '@sige/types';
import { toString as generarQr } from 'qrcode';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
import { CifradorSecretos } from '../security/secret-cipher.service';
import { generarCodigoRecuperacion, resumirSecreto } from '../security/tokens';
import { construirUrlTotp, generarSecretoTotp, verificarCodigoTotp } from '../security/totp';

const CANTIDAD_CODIGOS_RECUPERACION = 10;

@Injectable()
export class ConfiguracionMfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cifrador: CifradorSecretos,
    private readonly auditoria: AuditoriaService,
  ) {}

  async iniciar(autenticado: UsuarioAutenticado): Promise<ConfiguracionMfa> {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: autenticado.usuarioId },
    });

    if (usuario.mfaActivo) {
      throw new ConflictException({
        mensaje: 'La verificación en dos pasos ya está activa en su cuenta.',
        errores: [],
      });
    }

    const secreto = generarSecretoTotp();
    const urlOtpauth = construirUrlTotp(secreto, usuario.correo);

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { mfaSecretoPendienteCifrado: this.cifrador.cifrar(secreto) },
    });

    const qrSvg = await generarQr(urlOtpauth, { type: 'svg', margin: 1, width: 220 });

    return { secreto, urlOtpauth, qrSvg };
  }

  async activar(
    autenticado: UsuarioAutenticado,
    codigo: string,
    cliente: ContextoCliente,
  ): Promise<CodigosRecuperacion> {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: autenticado.usuarioId },
    });

    if (usuario.mfaActivo) {
      throw new ConflictException({
        mensaje: 'La verificación en dos pasos ya está activa en su cuenta.',
        errores: [],
      });
    }

    if (usuario.mfaSecretoPendienteCifrado === null) {
      throw new ConflictException({
        mensaje: 'Primero genere el código QR de configuración.',
        errores: [],
      });
    }

    if (!verificarCodigoTotp(this.cifrador.descifrar(usuario.mfaSecretoPendienteCifrado), codigo)) {
      throw new BadRequestException({
        mensaje: 'El código no es válido.',
        errores: [
          {
            campo: 'codigo',
            mensaje: 'Ingrese el código de 6 dígitos que muestra la aplicación y verifique la hora del teléfono.',
          },
        ],
      });
    }

    const codigos = Array.from({ length: CANTIDAD_CODIGOS_RECUPERACION }, generarCodigoRecuperacion);
    const ahora = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: usuario.id },
        data: {
          mfaActivo: true,
          mfaSecretoCifrado: usuario.mfaSecretoPendienteCifrado,
          mfaSecretoPendienteCifrado: null,
        },
      });
      await tx.codigoRecuperacion.updateMany({
        where: { usuarioId: usuario.id, usadoEn: null, invalidadoEn: null },
        data: { invalidadoEn: ahora },
      });
      await tx.codigoRecuperacion.createMany({
        data: codigos.map((valor) => ({ usuarioId: usuario.id, hashCodigo: resumirSecreto(valor) })),
      });
      await this.auditoria.registrar(
        {
          actor: actorDesde(autenticado, cliente),
          accion: 'MODIFICAR',
          entidad: 'usuario',
          entidadId: usuario.id,
          antes: { mfaActivo: false },
          despues: { mfaActivo: true, codigosRecuperacionGenerados: CANTIDAD_CODIGOS_RECUPERACION },
        },
        tx,
      );
    });

    return { codigos };
  }
}
