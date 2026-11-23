import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { RestablecimientoContrasena, UsuarioDetalle } from '@sige/types';
import { PrismaService } from '../../prisma/prisma.service';
import { HashContrasenas } from '../security/password-hasher.service';
import { CODIGO_ROL_GERENCIA } from '../access-control/effective-permissions.service';
import { type ActorAuditoria, AuditoriaService, type ClienteBaseDatos } from '../audit/audit.service';
import { SesionesService } from '../auth/sessions.service';
import { ConsultaUsuariosService } from './users-query.service';

@Injectable()
export class GestionUsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly sesiones: SesionesService,
    private readonly consulta: ConsultaUsuariosService,
    private readonly hash: HashContrasenas,
  ) {}

  async asignarRoles(
    usuarioId: string,
    rolIds: readonly string[],
    actor: ActorAuditoria,
  ): Promise<UsuarioDetalle> {
    const anterior = await this.consulta.obtener(usuarioId);
    const solicitados = [...new Set(rolIds)];
    const roles = await this.prisma.rol.findMany({ where: { id: { in: solicitados }, activo: true } });

    if (roles.length !== solicitados.length) {
      throw new BadRequestException({
        mensaje: 'Uno o más roles no existen o están desactivados.',
        errores: [{ campo: 'rolIds', mensaje: 'Vuelva a cargar la página e intente nuevamente.' }],
      });
    }

    const actuales = anterior.roles.map(({ id }) => id);
    const retirar = actuales.filter((id) => !solicitados.includes(id));
    const asignar = solicitados.filter((id) => !actuales.includes(id));

    if (retirar.length === 0 && asignar.length === 0) {
      return anterior;
    }

    const pierdeGerencia = anterior.roles.some(
      ({ id, codigo }) => codigo === CODIGO_ROL_GERENCIA && retirar.includes(id),
    );

    await this.prisma.$transaction(async (tx) => {
      if (pierdeGerencia) {
        await this.asegurarOtraGerencia(usuarioId, tx);
      }

      const ahora = new Date();

      if (retirar.length > 0) {
        await tx.usuarioRol.updateMany({
          where: { usuarioId, rolId: { in: retirar }, retiradoEn: null },
          data: { retiradoEn: ahora, retiradoPorId: actor.usuarioId },
        });
      }

      if (asignar.length > 0) {
        await tx.usuarioRol.createMany({
          data: asignar.map((rolId) => ({ usuarioId, rolId, asignadoPorId: actor.usuarioId })),
        });
      }

      await this.auditoria.registrar(
        {
          actor,
          accion: 'MODIFICAR',
          entidad: 'usuario',
          entidadId: usuarioId,
          antes: { roles: anterior.roles.map(({ codigo }) => codigo) },
          despues: { roles: roles.map(({ codigo }) => codigo) },
        },
        tx,
      );
    });

    return this.consulta.obtener(usuarioId);
  }

  async desactivar(usuarioId: string, motivo: string, actor: ActorAuditoria): Promise<UsuarioDetalle> {
    if (usuarioId === actor.usuarioId) {
      throw new BadRequestException({ mensaje: 'No puede desactivar su propia cuenta.', errores: [] });
    }

    const usuario = await this.consulta.obtener(usuarioId);

    if (!usuario.activo) {
      return usuario;
    }

    await this.prisma.$transaction(async (tx) => {
      if (usuario.roles.some(({ codigo }) => codigo === CODIGO_ROL_GERENCIA)) {
        await this.asegurarOtraGerencia(usuarioId, tx);
      }

      await tx.usuario.update({ where: { id: usuarioId }, data: { activo: false } });

      const sesionesCerradas = await this.sesiones.revocarDeUsuario(
        usuarioId,
        actor.usuarioId,
        `Usuario desactivado: ${motivo}`,
        tx,
      );

      await this.auditoria.registrar(
        {
          actor,
          accion: 'DESACTIVAR',
          entidad: 'usuario',
          entidadId: usuarioId,
          antes: { activo: true },
          despues: { activo: false, sesionesCerradas },
          motivo,
        },
        tx,
      );
    });

    return this.consulta.obtener(usuarioId);
  }

  async activar(usuarioId: string, motivo: string, actor: ActorAuditoria): Promise<UsuarioDetalle> {
    const usuario = await this.consulta.obtener(usuarioId);

    if (usuario.activo) {
      return usuario;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: usuarioId },
        data: { activo: true, intentosFallidos: 0, bloqueadoHasta: null },
      });
      await this.auditoria.registrar(
        {
          actor,
          accion: 'ACTIVAR',
          entidad: 'usuario',
          entidadId: usuarioId,
          antes: { activo: false },
          despues: { activo: true },
          motivo,
        },
        tx,
      );
    });

    return this.consulta.obtener(usuarioId);
  }

  async revocarSesiones(usuarioId: string, motivo: string, actor: ActorAuditoria): Promise<UsuarioDetalle> {
    await this.consulta.obtener(usuarioId);

    await this.prisma.$transaction(async (tx) => {
      const sesionesCerradas = await this.sesiones.revocarDeUsuario(
        usuarioId,
        actor.usuarioId,
        motivo,
        tx,
      );

      await this.auditoria.registrar(
        {
          actor,
          accion: 'REVOCAR_SESION',
          entidad: 'usuario',
          entidadId: usuarioId,
          despues: { sesionesCerradas },
          motivo,
        },
        tx,
      );
    });

    return this.consulta.obtener(usuarioId);
  }

  async restablecerMfa(usuarioId: string, motivo: string, actor: ActorAuditoria): Promise<UsuarioDetalle> {
    const usuario = await this.consulta.obtener(usuarioId);

    if (!usuario.mfaActivo) {
      throw new ConflictException({
        mensaje: 'El usuario no tiene activa la verificación en dos pasos.',
        errores: [],
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const ahora = new Date();

      await tx.usuario.update({
        where: { id: usuarioId },
        data: { mfaActivo: false, mfaSecretoCifrado: null, mfaSecretoPendienteCifrado: null },
      });
      await tx.codigoRecuperacion.updateMany({
        where: { usuarioId, usadoEn: null, invalidadoEn: null },
        data: { invalidadoEn: ahora },
      });

      const sesionesCerradas = await this.sesiones.revocarDeUsuario(
        usuarioId,
        actor.usuarioId,
        `Restablecimiento de verificación en dos pasos: ${motivo}`,
        tx,
      );

      await this.auditoria.registrar(
        {
          actor,
          accion: 'MODIFICAR',
          entidad: 'usuario',
          entidadId: usuarioId,
          antes: { mfaActivo: true },
          despues: { mfaActivo: false, sesionesCerradas },
          motivo,
        },
        tx,
      );
    });

    return this.consulta.obtener(usuarioId);
  }

  async restablecerContrasena(
    usuarioId: string,
    datos: RestablecimientoContrasena,
    actor: ActorAuditoria,
  ): Promise<UsuarioDetalle> {
    const { contrasena, motivo } = datos;

    if (usuarioId === actor.usuarioId) {
      throw new BadRequestException({
        mensaje: 'Para cambiar su propia contraseña use la opción de Mi cuenta.',
        errores: [],
      });
    }

    const usuario = await this.consulta.obtener(usuarioId);

    if (!usuario.activo) {
      throw new ConflictException({
        mensaje: 'Reactive la cuenta antes de restablecer su contraseña.',
        errores: [],
      });
    }

    const hashContrasena = await this.hash.hashear(contrasena);

    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: usuarioId },
        data: { hashContrasena, intentosFallidos: 0, bloqueadoHasta: null },
      });

      const sesionesCerradas = await this.sesiones.revocarDeUsuario(
        usuarioId,
        actor.usuarioId,
        `Restablecimiento de contraseña: ${motivo}`,
        tx,
      );

      await this.auditoria.registrar(
        {
          actor,
          accion: 'MODIFICAR',
          entidad: 'usuario',
          entidadId: usuarioId,
          despues: { contrasenaRestablecida: true, sesionesCerradas },
          motivo,
        },
        tx,
      );
    });

    return this.consulta.obtener(usuarioId);
  }

  private async asegurarOtraGerencia(usuarioId: string, db: ClienteBaseDatos): Promise<void> {
    const otras = await db.usuarioRol.count({
      where: {
        usuarioId: { not: usuarioId },
        retiradoEn: null,
        rol: { codigo: CODIGO_ROL_GERENCIA, activo: true },
        usuario: { activo: true },
      },
    });

    if (otras === 0) {
      throw new ConflictException({
        mensaje: 'Debe quedar al menos un usuario activo con el rol Gerencia General.',
        errores: [],
      });
    }
  }
}
