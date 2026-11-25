import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';
import { PermisosEfectivosService } from '../access-control/effective-permissions.service';
import { actorDesde, AuditoriaService, type ClienteBaseDatos } from '../audit/audit.service';
import { filtroEquipoProyecto } from '../projects/project-visibility';

export interface ParticipacionTarea {
  id: string;
  clienteId: string | null;
  responsableId: string;
  revisorId: string | null;
  asignadoPorId: string;
  colaboradorIds: string[];
}

export function filtroParticipacion(usuarioId: string): Prisma.TareaWhereInput[] {
  return [
    { responsableId: usuarioId },
    { revisorId: usuarioId },
    { asignadoPorId: usuarioId },
    { colaboradores: { some: { usuarioId, retiradoEn: null } } },
  ];
}

@Injectable()
export class AccesoTareasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permisos: PermisosEfectivosService,
    private readonly auditoria: AuditoriaService,
  ) {}

  filtroVisible(usuario: UsuarioAutenticado): Prisma.TareaWhereInput {
    if (usuario.alcance === 'GLOBAL') {
      return {};
    }

    const condiciones = filtroParticipacion(usuario.usuarioId);
    condiciones.push({ etapa: { proyecto: filtroEquipoProyecto(usuario.usuarioId) } });

    if (usuario.alcance === 'ASIGNADO') {
      condiciones.push({ cliente: { asignaciones: { some: { usuarioId: usuario.usuarioId, retiradoEn: null } } } });
    }

    return { OR: condiciones };
  }

  async obtenerVisible(
    usuario: UsuarioAutenticado,
    tareaId: string,
    contexto: ContextoCliente,
  ): Promise<ParticipacionTarea> {
    const tarea = await this.prisma.tarea.findUnique({
      where: { id: tareaId },
      select: {
        id: true,
        clienteId: true,
        responsableId: true,
        revisorId: true,
        asignadoPorId: true,
        colaboradores: { where: { retiradoEn: null }, select: { usuarioId: true } },
      },
    });

    if (tarea === null) {
      throw new NotFoundException({ mensaje: 'La tarea no existe.', errores: [] });
    }

    const visible = await this.prisma.tarea.count({ where: { AND: [{ id: tareaId }, this.filtroVisible(usuario)] } });

    if (visible === 0) {
      await this.auditoria.registrar({
        actor: actorDesde(usuario, contexto),
        accion: 'PERMISO_DENEGADO',
        entidad: 'tarea',
        entidadId: tareaId,
        motivo: 'Tarea fuera del alcance del usuario',
      });

      throw new ForbiddenException({ mensaje: 'No tiene acceso a esta tarea.', errores: [] });
    }

    return {
      id: tarea.id,
      clienteId: tarea.clienteId,
      responsableId: tarea.responsableId,
      revisorId: tarea.revisorId,
      asignadoPorId: tarea.asignadoPorId,
      colaboradorIds: tarea.colaboradores.map(({ usuarioId }) => usuarioId),
    };
  }

  async asegurarParticipante(
    usuarioId: string,
    clienteId: string | null,
    campo: string,
    db: ClienteBaseDatos,
  ): Promise<string> {
    const usuario = await db.usuario.findUnique({ where: { id: usuarioId }, select: { activo: true, nombre: true } });

    if (usuario?.activo !== true) {
      throw new BadRequestException({
        mensaje: 'Revise los datos ingresados.',
        errores: [{ campo, mensaje: 'Seleccione un usuario activo.' }],
      });
    }

    if (clienteId === null || (await this.permisos.resolver(usuarioId)).alcanceGlobal) {
      return usuario.nombre;
    }

    const asignado = await db.asignacionCliente.count({ where: { usuarioId, clienteId, retiradoEn: null } });

    if (asignado === 0) {
      throw new BadRequestException({
        mensaje: 'Revise los datos ingresados.',
        errores: [{ campo, mensaje: `${usuario.nombre} no está asignado a este cliente.` }],
      });
    }

    return usuario.nombre;
  }
}
