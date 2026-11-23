import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreacionRol, EdicionRol, RolResumen } from '@sige/types';
import { PrismaService } from '../../prisma/prisma.service';
import { type ActorAuditoria, AuditoriaService } from '../audit/audit.service';
import { CODIGO_ROL_GERENCIA } from './effective-permissions.service';
import { ConsultaRolesService } from './roles-query.service';

@Injectable()
export class GestionRolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly consulta: ConsultaRolesService,
  ) {}

  async crear(datos: CreacionRol, actor: ActorAuditoria): Promise<RolResumen> {
    const existente = await this.prisma.rol.findUnique({ where: { codigo: datos.codigo } });

    if (existente !== null) {
      throw new ConflictException({
        mensaje: 'Ya existe un rol con ese código.',
        errores: [{ campo: 'codigo', mensaje: 'Elija otro código.' }],
      });
    }

    const permisoIds = await this.validarPermisos(datos.permisoIds);

    const rol = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.rol.create({
        data: {
          codigo: datos.codigo,
          nombre: datos.nombre,
          descripcion: datos.descripcion,
          alcance: datos.alcance,
          exigeMfa: datos.exigeMfa,
          esSistema: false,
          permisos: { create: permisoIds.map((permisoId) => ({ permisoId })) },
        },
      });

      await this.auditoria.registrar(
        {
          actor,
          accion: 'CREAR',
          entidad: 'rol',
          entidadId: creado.id,
          despues: { ...datos, permisoIds },
        },
        tx,
      );

      return creado;
    });

    return this.consulta.obtener(rol.id);
  }

  async editar(id: string, datos: EdicionRol, actor: ActorAuditoria): Promise<RolResumen> {
    const anterior = await this.consulta.obtener(id);
    const permisoIds = await this.validarPermisos(datos.permisoIds);

    if (anterior.codigo === CODIGO_ROL_GERENCIA) {
      await this.validarRolGerencia(datos, permisoIds);
    }

    const retirar = anterior.permisoIds.filter((permisoId) => !permisoIds.includes(permisoId));
    const otorgar = permisoIds.filter((permisoId) => !anterior.permisoIds.includes(permisoId));

    await this.prisma.$transaction(async (tx) => {
      await tx.rol.update({
        where: { id },
        data: { nombre: datos.nombre, descripcion: datos.descripcion, exigeMfa: datos.exigeMfa },
      });

      if (retirar.length > 0) {
        await tx.rolPermiso.updateMany({
          where: { rolId: id, permisoId: { in: retirar }, retiradoEn: null },
          data: { retiradoEn: new Date() },
        });
      }

      if (otorgar.length > 0) {
        await tx.rolPermiso.createMany({
          data: otorgar.map((permisoId) => ({ rolId: id, permisoId })),
        });
      }

      await this.auditoria.registrar(
        {
          actor,
          accion: 'MODIFICAR',
          entidad: 'rol',
          entidadId: id,
          antes: {
            nombre: anterior.nombre,
            descripcion: anterior.descripcion,
            exigeMfa: anterior.exigeMfa,
            permisoIds: anterior.permisoIds,
          },
          despues: { ...datos, permisoIds },
        },
        tx,
      );
    });

    return this.consulta.obtener(id);
  }

  async desactivar(id: string, actor: ActorAuditoria): Promise<RolResumen> {
    const rol = await this.consulta.obtener(id);

    if (rol.esSistema) {
      throw new BadRequestException({
        mensaje: 'Los roles del sistema no se pueden desactivar.',
        errores: [],
      });
    }

    if (rol.totalUsuarios > 0) {
      const usuarios =
        rol.totalUsuarios === 1 ? 'su usuario activo' : `sus ${String(rol.totalUsuarios)} usuarios activos`;

      throw new ConflictException({
        mensaje: `Retire el rol de ${usuarios} antes de desactivarlo.`,
        errores: [],
      });
    }

    return this.cambiarEstado(rol, false, actor);
  }

  async activar(id: string, actor: ActorAuditoria): Promise<RolResumen> {
    return this.cambiarEstado(await this.consulta.obtener(id), true, actor);
  }

  private async cambiarEstado(
    rol: RolResumen,
    activo: boolean,
    actor: ActorAuditoria,
  ): Promise<RolResumen> {
    if (rol.activo === activo) {
      return rol;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rol.update({ where: { id: rol.id }, data: { activo } });
      await this.auditoria.registrar(
        {
          actor,
          accion: activo ? 'ACTIVAR' : 'DESACTIVAR',
          entidad: 'rol',
          entidadId: rol.id,
          antes: { activo: rol.activo },
          despues: { activo },
        },
        tx,
      );
    });

    return this.consulta.obtener(rol.id);
  }

  private async validarPermisos(permisoIds: readonly string[]): Promise<string[]> {
    const unicos = [...new Set(permisoIds)];
    const existentes = await this.prisma.permiso.count({ where: { id: { in: unicos } } });

    if (existentes !== unicos.length) {
      throw new NotFoundException({
        mensaje: 'Uno o más permisos seleccionados no existen.',
        errores: [{ campo: 'permisoIds', mensaje: 'Vuelva a cargar la página e intente nuevamente.' }],
      });
    }

    return unicos;
  }

  private async validarRolGerencia(datos: EdicionRol, permisoIds: readonly string[]): Promise<void> {
    const totalPermisos = await this.prisma.permiso.count();

    if (!datos.exigeMfa || permisoIds.length !== totalPermisos) {
      throw new BadRequestException({
        mensaje:
          'El rol Gerencia General conserva todos los permisos y la verificación en dos pasos obligatoria.',
        errores: [],
      });
    }
  }
}
