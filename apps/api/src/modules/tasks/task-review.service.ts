import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  accionDeEnvio,
  type CancelacionEntrada,
  type EnvioEntrada,
  estadoTrasAccion,
  type FinalizacionEntrada,
  type RevisionEntrada,
} from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificacionesService } from '../notifications/notifications.service';
import { AccesoTareasService, type ParticipacionTarea } from './task-access.service';
import { GestionTareasService } from './tasks-command.service';

function ejecutores(participacion: ParticipacionTarea): string[] {
  return [participacion.responsableId, ...participacion.colaboradorIds];
}

@Injectable()
export class RevisionTareasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoTareasService,
    private readonly gestion: GestionTareasService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  async enviar(
    id: string,
    entrada: EnvioEntrada,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const participacion = await this.acceso.obtenerVisible(usuario, id, contexto);

    if (!ejecutores(participacion).includes(usuario.usuarioId)) {
      throw new ForbiddenException({
        mensaje: 'Solo el responsable o un colaborador puede terminar la tarea.',
        errores: [],
      });
    }

    const tarea = await this.prisma.tarea.findUniqueOrThrow({
      where: { id },
      select: {
        codigo: true,
        titulo: true,
        estado: true,
        requiereAprobacion: true,
        requiereEvidencia: true,
        evidenciaRequerida: true,
        revisorId: true,
      },
    });
    const accion = accionDeEnvio(tarea.estado);

    if (accion === null) {
      throw new ConflictException({
        mensaje: 'Solo se puede terminar una tarea En proceso o Corregida.',
        errores: [],
      });
    }

    if (tarea.requiereEvidencia) {
      const evidencias = await this.prisma.evidencia.count({ where: { avance: { tareaId: id } } });

      if (evidencias === 0) {
        throw new BadRequestException({
          mensaje: 'La tarea exige evidencia y todavía no se adjuntó ninguna.',
          errores: [
            {
              campo: 'evidencias',
              mensaje: `Registre un avance con la evidencia requerida: ${tarea.evidenciaRequerida ?? 'archivos de respaldo'}.`,
            },
          ],
        });
      }
    }

    if (tarea.requiereAprobacion && tarea.revisorId === null) {
      throw new ConflictException({
        mensaje: 'La tarea requiere aprobación pero no tiene revisor. Pida a quien la asignó que defina uno.',
        errores: [],
      });
    }

    const notificados = await this.prisma.$transaction(async (tx) => {
      const destino = await this.gestion.cambiarEstado(
        id,
        accion,
        usuario,
        contexto,
        entrada.comentario ?? (accion === 'TERMINAR' ? 'Trabajo terminado' : 'Corrección enviada a revisión'),
        tx,
      );
      const enlace = `/tareas/${id}`;

      if (destino === 'EN_REVISION' && tarea.revisorId !== null) {
        return this.notificaciones.crear(
          {
            destinatarios: [tarea.revisorId],
            tipo: 'TAREA_POR_REVISAR',
            titulo: `Por revisar: ${tarea.titulo}`,
            mensaje: `${tarea.codigo} · ${accion === 'TERMINAR' ? 'Trabajo terminado' : 'Corrección enviada'}${entrada.comentario === null ? '' : ` · ${entrada.comentario}`}`,
            enlace,
            entidad: 'tarea',
            entidadId: id,
          },
          usuario.usuarioId,
          tx,
        );
      }

      return this.notificaciones.crear(
        {
          destinatarios: [participacion.asignadoPorId],
          tipo: 'AVANCE_REGISTRADO',
          titulo: `Tarea finalizada: ${tarea.titulo}`,
          mensaje: `${tarea.codigo} · No requería aprobación.`,
          enlace,
          entidad: 'tarea',
          entidadId: id,
        },
        usuario.usuarioId,
        tx,
      );
    });

    await this.notificaciones.publicar(notificados);
  }

  async revisar(
    id: string,
    entrada: RevisionEntrada,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const participacion = await this.acceso.obtenerVisible(usuario, id, contexto);

    if (ejecutores(participacion).includes(usuario.usuarioId)) {
      throw new ForbiddenException({
        mensaje: 'No puede aprobar ni observar una tarea en la que usted ejecuta el trabajo.',
        errores: [],
      });
    }

    if (!usuario.permisos.has('tarea:revisar')) {
      throw new ForbiddenException({ mensaje: 'Su rol no permite aprobar ni observar tareas.', errores: [] });
    }

    if (participacion.revisorId !== usuario.usuarioId && !usuario.alcanceGlobal) {
      throw new ForbiddenException({ mensaje: 'Solo el revisor asignado o Gerencia puede revisar esta tarea.', errores: [] });
    }

    const tarea = await this.prisma.tarea.findUniqueOrThrow({
      where: { id },
      select: { codigo: true, titulo: true, _count: { select: { rondas: true } } },
    });
    const aprobada = entrada.decision === 'APROBADA';

    const notificados = await this.prisma.$transaction(async (tx) => {
      await this.gestion.cambiarEstado(
        id,
        aprobada ? 'APROBAR' : 'OBSERVAR',
        usuario,
        contexto,
        entrada.comentario ?? 'Trabajo aprobado',
        tx,
      );

      await tx.rondaRevision.create({
        data: {
          tareaId: id,
          numero: tarea._count.rondas + 1,
          revisorId: usuario.usuarioId,
          decision: entrada.decision,
          comentario: entrada.comentario,
        },
      });

      return this.notificaciones.crear(
        {
          destinatarios: [...ejecutores(participacion), participacion.asignadoPorId],
          tipo: aprobada ? 'TRABAJO_APROBADO' : 'TRABAJO_OBSERVADO',
          titulo: aprobada ? `Trabajo aprobado: ${tarea.titulo}` : `Trabajo observado: ${tarea.titulo}`,
          mensaje: `${tarea.codigo} · Ronda ${String(tarea._count.rondas + 1)}${entrada.comentario === null ? '' : ` · ${entrada.comentario.slice(0, 160)}`}`,
          enlace: `/tareas/${id}`,
          entidad: 'tarea',
          entidadId: id,
        },
        usuario.usuarioId,
        tx,
      );
    });

    await this.notificaciones.publicar(notificados);
  }

  async finalizar(
    id: string,
    entrada: FinalizacionEntrada,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const participacion = await this.acceso.obtenerVisible(usuario, id, contexto);

    if (participacion.asignadoPorId !== usuario.usuarioId && !usuario.alcanceGlobal) {
      throw new ForbiddenException({ mensaje: 'Solo quien asignó la tarea o Gerencia puede finalizarla.', errores: [] });
    }

    await this.prisma.$transaction(async (tx) => {
      await this.gestion.cambiarEstado(id, 'FINALIZAR', usuario, contexto, entrada.comentario ?? 'Tarea finalizada', tx);
    });
  }

  async cancelar(
    id: string,
    entrada: CancelacionEntrada,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const participacion = await this.acceso.obtenerVisible(usuario, id, contexto);

    if (participacion.asignadoPorId !== usuario.usuarioId && !usuario.alcanceGlobal) {
      throw new ForbiddenException({ mensaje: 'Solo quien asignó la tarea o Gerencia puede cancelarla.', errores: [] });
    }

    const tarea = await this.prisma.tarea.findUniqueOrThrow({
      where: { id },
      select: { codigo: true, titulo: true, estado: true },
    });

    if (estadoTrasAccion(tarea.estado, 'CANCELAR', true) === null) {
      throw new ConflictException({
        mensaje: 'Solo se cancelan tareas Pendientes, En proceso u Observadas.',
        errores: [],
      });
    }

    const notificados = await this.prisma.$transaction(async (tx) => {
      await this.gestion.cambiarEstado(id, 'CANCELAR', usuario, contexto, entrada.motivo, tx, {
        motivoCancelacion: entrada.motivo,
      });

      return this.notificaciones.crear(
        {
          destinatarios: [
            ...ejecutores(participacion),
            ...(participacion.revisorId === null ? [] : [participacion.revisorId]),
          ],
          tipo: 'TAREA_CANCELADA',
          titulo: `Tarea cancelada: ${tarea.titulo}`,
          mensaje: `${tarea.codigo} · ${entrada.motivo.slice(0, 160)}`,
          enlace: `/tareas/${id}`,
          entidad: 'tarea',
          entidadId: id,
        },
        usuario.usuarioId,
        tx,
      );
    });

    await this.notificaciones.publicar(notificados);
  }
}
