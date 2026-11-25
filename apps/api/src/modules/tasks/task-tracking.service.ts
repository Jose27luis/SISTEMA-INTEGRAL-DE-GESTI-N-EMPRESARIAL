import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ESTADOS_CERRADOS, type ProrrogaEntrada, type ResolucionProrroga } from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb, aFechaIso, fechaHoyEnLima, formatearPlazoPeruano, horaEnLima } from '../../common/dates';
import { esViolacionDeUnicidad } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
import { NotificacionesService } from '../notifications/notifications.service';
import { AccesoTareasService } from './task-access.service';

@Injectable()
export class SeguimientoTareasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoTareasService,
    private readonly auditoria: AuditoriaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  async acusar(id: string, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<void> {
    const participacion = await this.acceso.obtenerVisible(usuario, id, contexto);

    if (participacion.responsableId !== usuario.usuarioId) {
      throw new ForbiddenException({ mensaje: 'Solo el responsable confirma la recepción de la tarea.', errores: [] });
    }

    const tarea = await this.prisma.tarea.findUniqueOrThrow({
      where: { id },
      select: { codigo: true, titulo: true, estado: true, seguimientoEstricto: true, recibidaEn: true },
    });

    if (!tarea.seguimientoEstricto || tarea.recibidaEn !== null || tarea.estado !== 'PENDIENTE') {
      throw new ConflictException({ mensaje: 'La recepción de esta tarea ya está confirmada o no aplica.', errores: [] });
    }

    const notificados = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.tarea.updateMany({
        where: { id, recibidaEn: null },
        data: { recibidaEn: new Date(), version: { increment: 1 } },
      });

      if (count === 0) {
        throw new ConflictException({ mensaje: 'La recepción ya estaba confirmada.', errores: [] });
      }

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'MODIFICAR',
          entidad: 'tarea',
          entidadId: id,
          despues: { recibida: true },
          motivo: 'Recepción confirmada',
        },
        tx,
      );

      return this.notificaciones.crear(
        {
          destinatarios: [participacion.asignadoPorId],
          tipo: 'AVANCE_REGISTRADO',
          titulo: `Tarea recibida: ${tarea.titulo}`,
          mensaje: `${tarea.codigo} · El responsable confirmó la recepción.`,
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

  async solicitarProrroga(
    id: string,
    entrada: ProrrogaEntrada,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const participacion = await this.acceso.obtenerVisible(usuario, id, contexto);

    if (participacion.responsableId !== usuario.usuarioId && !participacion.colaboradorIds.includes(usuario.usuarioId)) {
      throw new ForbiddenException({ mensaje: 'Solo el responsable o un colaborador puede pedir una prórroga.', errores: [] });
    }

    const tarea = await this.prisma.tarea.findUniqueOrThrow({
      where: { id },
      select: { codigo: true, titulo: true, estado: true, fechaLimite: true, horaLimite: true, seguimientoEstricto: true },
    });

    if (!tarea.seguimientoEstricto || ESTADOS_CERRADOS.includes(tarea.estado)) {
      throw new ConflictException({ mensaje: 'Esta tarea no admite prórrogas.', errores: [] });
    }

    const actual = aFechaIso(tarea.fechaLimite);
    const propuesta = `${entrada.fechaPropuesta} ${entrada.horaPropuesta ?? '24:00'}`;
    const vigente = `${actual} ${tarea.horaLimite ?? '24:00'}`;
    const ahora = `${fechaHoyEnLima()} ${horaEnLima(new Date())}`;

    if (propuesta <= vigente || propuesta <= ahora) {
      throw new BadRequestException({
        mensaje: 'Revise la nueva fecha.',
        errores: [
          {
            campo: 'fechaPropuesta',
            mensaje: `Debe ser posterior al plazo actual (${formatearPlazoPeruano(actual, tarea.horaLimite)}) y a este momento.`,
          },
        ],
      });
    }

    try {
      const notificados = await this.prisma.$transaction(async (tx) => {
        const prorroga = await tx.prorrogaTarea.create({
          data: {
            tareaId: id,
            fechaAnterior: tarea.fechaLimite,
            horaAnterior: tarea.horaLimite,
            fechaPropuesta: aFechaDb(entrada.fechaPropuesta),
            horaPropuesta: entrada.horaPropuesta,
            motivo: entrada.motivo,
            solicitadaPorId: usuario.usuarioId,
          },
        });

        await this.auditoria.registrar(
          {
            actor: actorDesde(usuario, contexto),
            accion: 'CREAR',
            entidad: 'prorroga_tarea',
            entidadId: prorroga.id,
            despues: { tareaId: id, fechaAnterior: actual, horaAnterior: tarea.horaLimite, ...entrada },
          },
          tx,
        );

        return this.notificaciones.crear(
          {
            destinatarios: [participacion.asignadoPorId],
            tipo: 'PRORROGA_SOLICITADA',
            titulo: `Prórroga solicitada: ${tarea.titulo}`,
            mensaje: `${tarea.codigo} · Del ${formatearPlazoPeruano(actual, tarea.horaLimite)} al ${formatearPlazoPeruano(entrada.fechaPropuesta, entrada.horaPropuesta)} · ${entrada.motivo}`,
            enlace: `/tareas/${id}#seguimiento`,
            entidad: 'tarea',
            entidadId: id,
          },
          usuario.usuarioId,
          tx,
        );
      });

      await this.notificaciones.publicar(notificados);
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        throw new ConflictException({ mensaje: 'Ya hay una prórroga esperando respuesta.', errores: [] });
      }

      throw error;
    }
  }

  async resolverProrroga(
    id: string,
    prorrogaId: string,
    entrada: ResolucionProrroga,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const participacion = await this.acceso.obtenerVisible(usuario, id, contexto);

    if (participacion.asignadoPorId !== usuario.usuarioId && !usuario.alcanceGlobal) {
      throw new ForbiddenException({ mensaje: 'Solo quien asignó la tarea o Gerencia resuelve la prórroga.', errores: [] });
    }

    const prorroga = await this.prisma.prorrogaTarea.findFirst({
      where: { id: prorrogaId, tareaId: id },
      include: { tarea: { select: { codigo: true, titulo: true, estado: true } } },
    });

    if (prorroga === null) {
      throw new NotFoundException({ mensaje: 'La prórroga no pertenece a esta tarea.', errores: [] });
    }

    if (prorroga.estado !== 'PENDIENTE') {
      throw new ConflictException({ mensaje: 'La prórroga ya fue resuelta.', errores: [] });
    }

    if (entrada.decision === 'APROBAR' && ESTADOS_CERRADOS.includes(prorroga.tarea.estado)) {
      throw new ConflictException({ mensaje: 'La tarea ya está cerrada.', errores: [] });
    }

    const aprobada = entrada.decision === 'APROBAR';
    const notificados = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.prorrogaTarea.updateMany({
        where: { id: prorrogaId, estado: 'PENDIENTE' },
        data: {
          estado: aprobada ? 'APROBADA' : 'RECHAZADA',
          resueltaPorId: usuario.usuarioId,
          resueltaEn: new Date(),
          respuesta: entrada.respuesta,
        },
      });

      if (count === 0) {
        throw new ConflictException({ mensaje: 'La prórroga ya fue resuelta.', errores: [] });
      }

      if (aprobada) {
        await tx.tarea.update({
          where: { id },
          data: { fechaLimite: prorroga.fechaPropuesta, horaLimite: prorroga.horaPropuesta, version: { increment: 1 } },
        });
      }

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'CAMBIAR_ESTADO',
          entidad: 'prorroga_tarea',
          entidadId: prorrogaId,
          antes: { estado: 'PENDIENTE', fechaLimite: aFechaIso(prorroga.fechaAnterior), horaLimite: prorroga.horaAnterior },
          despues: {
            estado: aprobada ? 'APROBADA' : 'RECHAZADA',
            fechaLimite: aFechaIso(aprobada ? prorroga.fechaPropuesta : prorroga.fechaAnterior),
            horaLimite: aprobada ? prorroga.horaPropuesta : prorroga.horaAnterior,
          },
          ...(entrada.respuesta === null ? {} : { motivo: entrada.respuesta }),
        },
        tx,
      );

      return this.notificaciones.crear(
        {
          destinatarios: [prorroga.solicitadaPorId, participacion.responsableId],
          tipo: 'PRORROGA_RESUELTA',
          titulo: `Prórroga ${aprobada ? 'aprobada' : 'rechazada'}: ${prorroga.tarea.titulo}`,
          mensaje: aprobada
            ? `${prorroga.tarea.codigo} · Nuevo plazo: ${formatearPlazoPeruano(aFechaIso(prorroga.fechaPropuesta), prorroga.horaPropuesta)}`
            : `${prorroga.tarea.codigo} · ${entrada.respuesta ?? ''}`,
          enlace: `/tareas/${id}#seguimiento`,
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
