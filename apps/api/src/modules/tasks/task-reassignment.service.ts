import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ESTADOS_CERRADOS } from '@sige/types';
import { PrismaService } from '../../prisma/prisma.service';
import { PermisosEfectivosService } from '../access-control/effective-permissions.service';
import { type ActorAuditoria, AuditoriaService, type ClienteBaseDatos } from '../audit/audit.service';
import { NotificacionesService } from '../notifications/notifications.service';
import { nuevoRevisor } from './reviewer-rules';

export interface ResultadoReasignacion {
  tareas: number;
  notificados: string[];
}

@Injectable()
export class ReasignacionTareasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permisos: PermisosEfectivosService,
    private readonly auditoria: AuditoriaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  async contarAbiertas(usuarioId: string, db: ClienteBaseDatos = this.prisma): Promise<number> {
    return db.tarea.count({
      where: {
        estado: { notIn: [...ESTADOS_CERRADOS] },
        OR: [{ responsableId: usuarioId }, { revisorId: usuarioId }],
      },
    });
  }

  async reasignar(
    salienteId: string,
    destinoId: string,
    actor: ActorAuditoria,
    db: ClienteBaseDatos,
  ): Promise<ResultadoReasignacion> {
    if (salienteId === destinoId) {
      throw new BadRequestException({
        mensaje: 'Revise los datos ingresados.',
        errores: [{ campo: 'reasignarAId', mensaje: 'Elija a otra persona para recibir las tareas.' }],
      });
    }

    const destino = await db.usuario.findUnique({ where: { id: destinoId }, select: { activo: true, nombre: true } });

    if (destino?.activo !== true) {
      throw new BadRequestException({
        mensaje: 'Revise los datos ingresados.',
        errores: [{ campo: 'reasignarAId', mensaje: 'Seleccione un usuario activo.' }],
      });
    }

    const tareas = await db.tarea.findMany({
      where: {
        estado: { notIn: [...ESTADOS_CERRADOS] },
        OR: [{ responsableId: salienteId }, { revisorId: salienteId }],
      },
      select: { id: true, codigo: true, clienteId: true, responsableId: true, revisorId: true, asignadoPorId: true },
    });

    const destinoGlobal = (await this.permisos.resolver(destinoId)).alcanceGlobal;
    const clientes = [...new Set(tareas.map(({ clienteId }) => clienteId).filter((id): id is string => id !== null))];
    const asignados = destinoGlobal
      ? new Set(clientes)
      : new Set(
          (
            await db.asignacionCliente.findMany({
              where: { usuarioId: destinoId, clienteId: { in: clientes }, retiradoEn: null },
              select: { clienteId: true },
            })
          ).map(({ clienteId }) => clienteId),
        );
    const sinAcceso = tareas.filter(({ clienteId }) => clienteId !== null && !asignados.has(clienteId));

    if (sinAcceso.length > 0) {
      throw new ConflictException({
        mensaje: `${destino.nombre} no está asignado a los clientes de estas tareas: ${sinAcceso.map(({ codigo }) => codigo).join(', ')}. Asígnelo primero a esos clientes.`,
        errores: [{ campo: 'reasignarAId', mensaje: 'El usuario no atiende a todos los clientes involucrados.' }],
      });
    }

    for (const tarea of tareas) {
      const responsableFinal = tarea.responsableId === salienteId ? destinoId : tarea.responsableId;
      const revisorFinal = nuevoRevisor(tarea.revisorId, salienteId, destinoId, responsableFinal, tarea.asignadoPorId);

      await db.tarea.update({
        where: { id: tarea.id },
        data: {
          responsableId: responsableFinal,
          revisorId: revisorFinal,
          ...(revisorFinal === null ? { requiereAprobacion: false } : {}),
          version: { increment: 1 },
        },
      });

      await this.auditoria.registrar(
        {
          actor,
          accion: 'MODIFICAR',
          entidad: 'tarea',
          entidadId: tarea.id,
          antes: { responsableId: tarea.responsableId, revisorId: tarea.revisorId },
          despues: { responsableId: responsableFinal, revisorId: revisorFinal },
          motivo: 'Reasignación por baja del personal',
        },
        db,
      );
    }

    await db.tareaColaborador.updateMany({
      where: { usuarioId: salienteId, retiradoEn: null, tarea: { estado: { notIn: [...ESTADOS_CERRADOS] } } },
      data: { retiradoEn: new Date() },
    });

    const notificados =
      tareas.length === 0
        ? []
        : await this.notificaciones.crear(
            {
              destinatarios: [destinoId],
              tipo: 'TAREA_REASIGNADA',
              titulo: `Recibió ${String(tareas.length)} ${tareas.length === 1 ? 'tarea reasignada' : 'tareas reasignadas'}`,
              mensaje: tareas.map(({ codigo }) => codigo).join(', '),
              enlace: '/mi-trabajo',
              entidad: 'usuario',
              entidadId: destinoId,
            },
            actor.usuarioId,
            db,
          );

    return { tareas: tareas.length, notificados };
  }
}
