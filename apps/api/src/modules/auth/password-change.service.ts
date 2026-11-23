import { BadRequestException, Injectable } from '@nestjs/common';
import type { CambioContrasena } from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
import { HashContrasenas } from '../security/password-hasher.service';
import { SesionesService } from './sessions.service';

@Injectable()
export class CambioContrasenaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hash: HashContrasenas,
    private readonly sesiones: SesionesService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async cambiar(
    autenticado: UsuarioAutenticado,
    datos: CambioContrasena,
    cliente: ContextoCliente,
  ): Promise<void> {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: autenticado.usuarioId },
    });

    if (!(await this.hash.verificar(usuario.hashContrasena, datos.actual))) {
      throw new BadRequestException({
        mensaje: 'Revise los datos ingresados.',
        errores: [{ campo: 'actual', mensaje: 'La contraseña actual no es correcta.' }],
      });
    }

    if (datos.nueva === datos.actual) {
      throw new BadRequestException({
        mensaje: 'Revise los datos ingresados.',
        errores: [{ campo: 'nueva', mensaje: 'Debe ser distinta de la contraseña actual.' }],
      });
    }

    const hashNuevo = await this.hash.hashear(datos.nueva);

    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({ where: { id: usuario.id }, data: { hashContrasena: hashNuevo } });

      const sesionesCerradas = await this.sesiones.revocarDeUsuario(
        usuario.id,
        usuario.id,
        'Cambio de contraseña',
        tx,
        autenticado.sesionId,
      );

      await this.auditoria.registrar(
        {
          actor: actorDesde(autenticado, cliente),
          accion: 'MODIFICAR',
          entidad: 'usuario',
          entidadId: usuario.id,
          despues: { contrasenaActualizada: true, otrasSesionesCerradas: sesionesCerradas },
        },
        tx,
      );
    });
  }
}
