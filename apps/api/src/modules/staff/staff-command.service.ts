import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type {
  AltaTrabajador,
  CeseTrabajador,
  FichaTrabajador,
  TrabajadorDetalle,
} from '@sige/types';
import { aFechaDb } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { type ActorAuditoria, AuditoriaService, type ClienteBaseDatos } from '../audit/audit.service';
import { CatalogosService } from '../catalogs/catalogs.service';
import { HashContrasenas } from '../security/password-hasher.service';
import { GestionUsuariosService } from '../users/users-management.service';
import { ConsultaPersonalService } from './staff-query.service';

function datosFicha(ficha: FichaTrabajador): {
  nombres: string;
  apellidos: string;
  dni: string;
  cargoId: string;
  areaId: string;
  tipoVinculoId: string;
  fechaIncorporacion: Date;
  horario: string | null;
  telefono: string | null;
  funciones: string | null;
  supervisorId: string | null;
} {
  return {
    nombres: ficha.nombres,
    apellidos: ficha.apellidos,
    dni: ficha.dni,
    cargoId: ficha.cargoId,
    areaId: ficha.areaId,
    tipoVinculoId: ficha.tipoVinculoId,
    fechaIncorporacion: aFechaDb(ficha.fechaIncorporacion),
    horario: ficha.horario,
    telefono: ficha.telefono,
    funciones: ficha.funciones,
    supervisorId: ficha.supervisorId,
  };
}

function nombreCompleto(ficha: Pick<FichaTrabajador, 'nombres' | 'apellidos'>): string {
  return `${ficha.nombres} ${ficha.apellidos}`;
}

@Injectable()
export class GestionPersonalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly catalogos: CatalogosService,
    private readonly hash: HashContrasenas,
    private readonly usuarios: GestionUsuariosService,
    private readonly consulta: ConsultaPersonalService,
  ) {}

  async crear(alta: AltaTrabajador, actor: ActorAuditoria): Promise<TrabajadorDetalle> {
    await this.validarFicha(alta, null, this.prisma);

    const cuenta = alta.cuenta;
    let usuarioExistenteId: string | null = null;
    let hashContrasena: string | null = null;

    if (cuenta.tipo === 'NUEVA') {
      if ((await this.prisma.usuario.count({ where: { correo: cuenta.correo } })) > 0) {
        throw new ConflictException({
          mensaje: 'Revise los datos ingresados.',
          errores: [{ campo: 'correo', mensaje: 'Ya existe un usuario con ese correo.' }],
        });
      }

      const rolesActivos = await this.prisma.rol.count({ where: { id: { in: cuenta.rolIds }, activo: true } });

      if (rolesActivos !== new Set(cuenta.rolIds).size) {
        throw new BadRequestException({
          mensaje: 'Revise los datos ingresados.',
          errores: [{ campo: 'rolIds', mensaje: 'Uno o más roles no existen o están desactivados.' }],
        });
      }

      hashContrasena = await this.hash.hashear(cuenta.contrasena);
    } else {
      const usuario = await this.prisma.usuario.findUnique({
        where: { id: cuenta.usuarioId },
        include: { trabajador: { select: { id: true } } },
      });

      if (usuario === null || !usuario.activo || usuario.trabajador !== null) {
        throw new ConflictException({
          mensaje: 'Revise los datos ingresados.',
          errores: [{ campo: 'usuarioId', mensaje: 'El usuario no existe, está inactivo o ya tiene ficha.' }],
        });
      }

      usuarioExistenteId = usuario.id;
    }

    const trabajadorId = await this.prisma.$transaction(async (tx) => {
      let usuarioId = usuarioExistenteId;

      if (cuenta.tipo === 'NUEVA' && hashContrasena !== null) {
        const usuario = await tx.usuario.create({
          data: {
            nombre: nombreCompleto(alta),
            correo: cuenta.correo,
            hashContrasena,
            roles: {
              create: [...new Set(cuenta.rolIds)].map((rolId) => ({ rolId, asignadoPorId: actor.usuarioId })),
            },
          },
        });

        usuarioId = usuario.id;

        await this.auditoria.registrar(
          {
            actor,
            accion: 'CREAR',
            entidad: 'usuario',
            entidadId: usuario.id,
            despues: { nombre: usuario.nombre, correo: usuario.correo, rolIds: cuenta.rolIds },
          },
          tx,
        );
      } else if (usuarioId !== null) {
        await tx.usuario.update({ where: { id: usuarioId }, data: { nombre: nombreCompleto(alta) } });
      }

      if (usuarioId === null) {
        throw new BadRequestException({ mensaje: 'No se pudo determinar la cuenta del trabajador.', errores: [] });
      }

      const trabajador = await tx.trabajador.create({ data: { ...datosFicha(alta), usuarioId } });

      await this.auditoria.registrar(
        {
          actor,
          accion: 'CREAR',
          entidad: 'trabajador',
          entidadId: trabajador.id,
          despues: { nombre: nombreCompleto(alta), dni: alta.dni, usuarioId },
        },
        tx,
      );

      return trabajador.id;
    });

    return this.consulta.obtener(trabajadorId);
  }

  async editar(id: string, ficha: FichaTrabajador, actor: ActorAuditoria): Promise<TrabajadorDetalle> {
    const anterior = await this.consulta.obtener(id);

    await this.validarFicha(ficha, id, this.prisma);

    await this.prisma.$transaction(async (tx) => {
      await tx.trabajador.update({ where: { id }, data: datosFicha(ficha) });
      await tx.usuario.update({ where: { id: anterior.usuarioId }, data: { nombre: nombreCompleto(ficha) } });
      await this.auditoria.registrar(
        {
          actor,
          accion: 'MODIFICAR',
          entidad: 'trabajador',
          entidadId: id,
          antes: {
            nombres: anterior.nombres,
            apellidos: anterior.apellidos,
            dni: anterior.dni,
            cargoId: anterior.cargo.id,
            areaId: anterior.area.id,
            tipoVinculoId: anterior.tipoVinculo.id,
            fechaIncorporacion: anterior.fechaIncorporacion,
            supervisorId: anterior.supervisor?.id ?? null,
          },
          despues: { ...ficha },
        },
        tx,
      );
    });

    return this.consulta.obtener(id);
  }

  async cesar(id: string, cese: CeseTrabajador, actor: ActorAuditoria): Promise<TrabajadorDetalle> {
    const trabajador = await this.consulta.obtener(id);

    if (cese.fechaCese < trabajador.fechaIncorporacion) {
      throw new BadRequestException({
        mensaje: 'Revise los datos ingresados.',
        errores: [{ campo: 'fechaCese', mensaje: 'La fecha de cese no puede ser anterior a la de incorporación.' }],
      });
    }

    await this.usuarios.desactivar(trabajador.usuarioId, cese.motivo, actor, cese.fechaCese);

    return this.consulta.obtener(id);
  }

  async reactivar(id: string, motivo: string, actor: ActorAuditoria): Promise<TrabajadorDetalle> {
    const trabajador = await this.consulta.obtener(id);

    await this.usuarios.activar(trabajador.usuarioId, motivo, actor);

    return this.consulta.obtener(id);
  }

  private async validarFicha(
    ficha: FichaTrabajador,
    trabajadorId: string | null,
    db: ClienteBaseDatos,
  ): Promise<void> {
    await this.catalogos.asegurarActivo('areas', ficha.areaId, 'areaId', db);
    await this.catalogos.asegurarActivo('cargos', ficha.cargoId, 'cargoId', db);
    await this.catalogos.asegurarActivo('tipos-vinculo', ficha.tipoVinculoId, 'tipoVinculoId', db);

    const mismoDni = await db.trabajador.findUnique({ where: { dni: ficha.dni }, select: { id: true } });

    if (mismoDni !== null && mismoDni.id !== trabajadorId) {
      throw new ConflictException({
        mensaje: 'Revise los datos ingresados.',
        errores: [{ campo: 'dni', mensaje: 'Ya existe un trabajador con ese DNI.' }],
      });
    }

    if (ficha.supervisorId !== null) {
      const supervisor = await db.trabajador.findUnique({
        where: { id: ficha.supervisorId },
        select: { id: true, estado: true },
      });

      if (supervisor?.estado !== 'ACTIVO' || supervisor.id === trabajadorId) {
        throw new BadRequestException({
          mensaje: 'Revise los datos ingresados.',
          errores: [{ campo: 'supervisorId', mensaje: 'Seleccione un supervisor activo distinto del trabajador.' }],
        });
      }
    }
  }
}
