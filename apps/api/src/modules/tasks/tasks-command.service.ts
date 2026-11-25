import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  type AccionTarea,
  type EdicionTarea,
  type EstadoTarea,
  ESTADOS_CERRADOS,
  estadoTrasAccion,
  ETIQUETAS_PRIORIDAD,
  type TareaEntrada,
} from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb, aFechaIso, formatearFechaPeruana } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { PermisosEfectivosService } from '../access-control/effective-permissions.service';
import { actorDesde, AuditoriaService, type ClienteBaseDatos } from '../audit/audit.service';
import { NotificacionesService } from '../notifications/notifications.service';
import { AccesoTareasService } from './task-access.service';
import { generarCodigoTarea } from './task-code';

function datosTarea(entrada: TareaEntrada): {
  titulo: string;
  instrucciones: string | null;
  clienteId: string | null;
  responsableId: string;
  revisorId: string | null;
  prioridad: TareaEntrada['prioridad'];
  fechaInicio: Date | null;
  fechaLimite: Date;
  requiereAprobacion: boolean;
  requiereEvidencia: boolean;
  evidenciaRequerida: string | null;
  etapaId: string | null;
} {
  return {
    etapaId: entrada.etapaId,
    titulo: entrada.titulo,
    instrucciones: entrada.instrucciones,
    clienteId: entrada.clienteId,
    responsableId: entrada.responsableId,
    revisorId: entrada.revisorId,
    prioridad: entrada.prioridad,
    fechaInicio: entrada.fechaInicio === null ? null : aFechaDb(entrada.fechaInicio),
    fechaLimite: aFechaDb(entrada.fechaLimite),
    requiereAprobacion: entrada.requiereAprobacion,
    requiereEvidencia: entrada.requiereEvidencia,
    evidenciaRequerida: entrada.requiereEvidencia ? entrada.evidenciaRequerida : null,
  };
}

@Injectable()
export class GestionTareasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoTareasService,
    private readonly auditoria: AuditoriaService,
    private readonly notificaciones: NotificacionesService,
    private readonly permisos: PermisosEfectivosService,
  ) {}

  async crear(entrada: TareaEntrada, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<string> {
    await this.validar(entrada, usuario, this.prisma);

    const colaboradorIds = [...new Set(entrada.colaboradorIds)].filter((id) => id !== entrada.responsableId);
    const notificados: string[] = [];

    const tareaId = await this.prisma.$transaction(async (tx) => {
      const codigo = await generarCodigoTarea(tx);
      const tarea = await tx.tarea.create({
        data: {
          ...datosTarea(entrada),
          codigo,
          asignadoPorId: usuario.usuarioId,
          plantillaId: entrada.plantillaId,
          seguimientoEstricto: true,
        },
      });

      if (entrada.items.length > 0) {
        await tx.itemVerificacion.createMany({
          data: entrada.items.map((texto, orden) => ({ tareaId: tarea.id, texto, orden })),
        });
      }

      if (colaboradorIds.length > 0) {
        await tx.tareaColaborador.createMany({
          data: colaboradorIds.map((usuarioId) => ({ tareaId: tarea.id, usuarioId })),
        });
      }

      await tx.transicionTarea.create({
        data: { tareaId: tarea.id, hacia: 'PENDIENTE', usuarioId: usuario.usuarioId, comentario: 'Tarea asignada' },
      });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'CREAR',
          entidad: 'tarea',
          entidadId: tarea.id,
          despues: { codigo, ...entrada, colaboradorIds },
        },
        tx,
      );

      const enlace = `/tareas/${tarea.id}`;
      const mensaje = `${codigo} · Prioridad ${ETIQUETAS_PRIORIDAD[entrada.prioridad].toLowerCase()} · Vence el ${formatearFechaPeruana(entrada.fechaLimite)}`;

      notificados.push(
        ...(await this.notificaciones.crear(
          {
            destinatarios: [entrada.responsableId, ...colaboradorIds],
            tipo: 'TAREA_ASIGNADA',
            titulo: `Nueva tarea: ${entrada.titulo}`,
            mensaje,
            enlace,
            entidad: 'tarea',
            entidadId: tarea.id,
          },
          usuario.usuarioId,
          tx,
        )),
      );

      if (entrada.revisorId !== null) {
        notificados.push(
          ...(await this.notificaciones.crear(
            {
              destinatarios: [entrada.revisorId],
              tipo: 'TAREA_ASIGNADA',
              titulo: `Revisará la tarea: ${entrada.titulo}`,
              mensaje,
              enlace,
              entidad: 'tarea',
              entidadId: tarea.id,
            },
            usuario.usuarioId,
            tx,
          )),
        );
      }

      return tarea.id;
    });

    await this.notificaciones.publicar(notificados);
    return tareaId;
  }

  async editar(
    id: string,
    entrada: EdicionTarea,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const anterior = await this.prisma.tarea.findUniqueOrThrow({
      where: { id },
      include: { colaboradores: { where: { retiradoEn: null }, select: { usuarioId: true } } },
    });

    if (
      ESTADOS_CERRADOS.includes(anterior.estado) ||
      !(anterior.asignadoPorId === usuario.usuarioId || usuario.alcanceGlobal)
    ) {
      throw new ForbiddenException({
        mensaje: 'Solo quien asignó la tarea o Gerencia puede modificarla mientras esté abierta.',
        errores: [],
      });
    }

    if (anterior.seguimientoEstricto && aFechaIso(anterior.fechaLimite) !== entrada.fechaLimite) {
      throw new BadRequestException({
        mensaje: 'La fecha límite no se edita directamente.',
        errores: [{ campo: 'fechaLimite', mensaje: 'El responsable debe pedir una prórroga y usted aprobarla.' }],
      });
    }

    await this.validar(entrada, usuario, this.prisma);

    const colaboradorIds = [...new Set(entrada.colaboradorIds)].filter((colaboradorId) => colaboradorId !== entrada.responsableId);
    const anteriores = anterior.colaboradores.map(({ usuarioId }) => usuarioId);
    const notificados: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      const actualizacion = await tx.tarea.updateMany({
        where: { id, version: entrada.version },
        data: { ...datosTarea(entrada), version: { increment: 1 } },
      });

      if (actualizacion.count === 0) {
        throw new ConflictException({
          mensaje: 'Otra persona modificó la tarea mientras la editaba. Recargue la página y vuelva a intentarlo.',
          errores: [],
        });
      }

      const retirar = anteriores.filter((colaboradorId) => !colaboradorIds.includes(colaboradorId));
      const agregar = colaboradorIds.filter((colaboradorId) => !anteriores.includes(colaboradorId));

      if (retirar.length > 0) {
        await tx.tareaColaborador.updateMany({
          where: { tareaId: id, usuarioId: { in: retirar }, retiradoEn: null },
          data: { retiradoEn: new Date() },
        });
      }

      if (agregar.length > 0) {
        await tx.tareaColaborador.createMany({ data: agregar.map((usuarioId) => ({ tareaId: id, usuarioId })) });
      }

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'MODIFICAR',
          entidad: 'tarea',
          entidadId: id,
          antes: {
            titulo: anterior.titulo,
            responsableId: anterior.responsableId,
            revisorId: anterior.revisorId,
            prioridad: anterior.prioridad,
            fechaLimite: anterior.fechaLimite.toISOString().slice(0, 10),
            colaboradorIds: anteriores,
          },
          despues: { ...entrada, colaboradorIds },
        },
        tx,
      );

      const enlace = `/tareas/${id}`;

      notificados.push(
        ...(await this.notificaciones.crear(
          {
            destinatarios: [entrada.responsableId, ...colaboradorIds].filter(
              (destinatario) => destinatario !== entrada.responsableId || anterior.responsableId === entrada.responsableId,
            ),
            tipo: 'TAREA_MODIFICADA',
            titulo: `Tarea modificada: ${entrada.titulo}`,
            mensaje: `${anterior.codigo} · Revise las instrucciones, fechas y prioridad.`,
            enlace,
            entidad: 'tarea',
            entidadId: id,
          },
          usuario.usuarioId,
          tx,
        )),
      );

      if (anterior.responsableId !== entrada.responsableId) {
        notificados.push(
          ...(await this.notificaciones.crear(
            {
              destinatarios: [entrada.responsableId],
              tipo: 'TAREA_REASIGNADA',
              titulo: `Ahora es responsable de: ${entrada.titulo}`,
              mensaje: `${anterior.codigo} · Vence el ${formatearFechaPeruana(entrada.fechaLimite)}`,
              enlace,
              entidad: 'tarea',
              entidadId: id,
            },
            usuario.usuarioId,
            tx,
          )),
        );
      }
    });

    await this.notificaciones.publicar(notificados);
  }

  async iniciar(id: string, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<void> {
    const participacion = await this.acceso.obtenerVisible(usuario, id, contexto);

    if (
      participacion.responsableId !== usuario.usuarioId &&
      !participacion.colaboradorIds.includes(usuario.usuarioId)
    ) {
      throw new ForbiddenException({ mensaje: 'Solo el responsable o un colaborador puede iniciar la tarea.', errores: [] });
    }

    await this.asegurarRecibida(id);

    await this.prisma.$transaction(async (tx) => {
      await this.cambiarEstado(id, 'INICIAR', usuario, contexto, 'Tarea iniciada', tx);
    });
  }

  async asegurarRecibida(id: string): Promise<void> {
    const tarea = await this.prisma.tarea.findUniqueOrThrow({
      where: { id },
      select: { seguimientoEstricto: true, recibidaEn: true },
    });

    if (tarea.seguimientoEstricto && tarea.recibidaEn === null) {
      throw new ConflictException({
        mensaje: 'Primero el responsable debe confirmar que recibió la tarea.',
        errores: [],
      });
    }
  }

  async cambiarEstado(
    id: string,
    accion: AccionTarea,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
    comentario: string | null,
    db: ClienteBaseDatos,
    adicionales: { motivoCancelacion?: string } = {},
  ): Promise<EstadoTarea> {
    const tarea = await db.tarea.findUniqueOrThrow({
      where: { id },
      select: { estado: true, requiereAprobacion: true, completadaEn: true },
    });
    const destino = estadoTrasAccion(tarea.estado, accion, tarea.requiereAprobacion);

    if (destino === null) {
      throw new ConflictException({
        mensaje: 'La tarea ya no está en un estado que permita esta acción. Recargue la página.',
        errores: [],
      });
    }

    const completa = (destino === 'APROBADA' || destino === 'FINALIZADA') && tarea.completadaEn === null;
    const actualizacion = await db.tarea.updateMany({
      where: { id, estado: tarea.estado },
      data: {
        estado: destino,
        version: { increment: 1 },
        ...(completa ? { completadaEn: new Date() } : {}),
        ...(adicionales.motivoCancelacion === undefined ? {} : { motivoCancelacion: adicionales.motivoCancelacion }),
      },
    });

    if (actualizacion.count === 0) {
      throw new ConflictException({ mensaje: 'Otra persona cambió el estado de la tarea. Recargue la página.', errores: [] });
    }

    await db.transicionTarea.create({
      data: { tareaId: id, desde: tarea.estado, hacia: destino, usuarioId: usuario.usuarioId, comentario },
    });

    await this.auditoria.registrar(
      {
        actor: actorDesde(usuario, contexto),
        accion: 'CAMBIAR_ESTADO',
        entidad: 'tarea',
        entidadId: id,
        antes: { estado: tarea.estado },
        despues: { estado: destino },
        ...(comentario === null ? {} : { motivo: comentario }),
      },
      db,
    );

    return destino;
  }

  private async validarEtapa(entrada: TareaEntrada, usuario: UsuarioAutenticado, db: ClienteBaseDatos): Promise<void> {
    const etapa = await db.etapaProyecto.findUnique({
      where: { id: entrada.etapaId ?? '' },
      select: {
        proyecto: {
          select: {
            estado: true,
            clienteId: true,
            responsableId: true,
            miembros: { where: { retiradoEn: null }, select: { usuarioId: true } },
          },
        },
      },
    });
    const error = (campo: string, mensaje: string): BadRequestException =>
      new BadRequestException({ mensaje: 'Revise los datos ingresados.', errores: [{ campo, mensaje }] });

    if (etapa === null) {
      throw error('etapaId', 'La etapa no existe.');
    }

    const { proyecto } = etapa;
    const equipo = new Set([proyecto.responsableId, ...proyecto.miembros.map(({ usuarioId }) => usuarioId)]);

    if (proyecto.estado === 'FINALIZADO' || proyecto.estado === 'CANCELADO') {
      throw error('etapaId', 'El proyecto está cerrado y no admite tareas.');
    }

    if (!usuario.alcanceGlobal && !equipo.has(usuario.usuarioId)) {
      throw new ForbiddenException({ mensaje: 'Solo el equipo del proyecto puede crear o editar sus tareas.', errores: [] });
    }

    if (entrada.clienteId !== proyecto.clienteId) {
      throw error('clienteId', 'La tarea debe ser del mismo cliente que el proyecto.');
    }

    if (!equipo.has(entrada.responsableId)) {
      throw error('responsableId', 'El responsable debe pertenecer al equipo del proyecto.');
    }
  }

  private async validar(entrada: TareaEntrada, usuario: UsuarioAutenticado, db: ClienteBaseDatos): Promise<void> {
    if (entrada.plantillaId !== null) {
      const plantilla = await db.plantillaTarea.findUnique({ where: { id: entrada.plantillaId }, select: { activo: true } });

      if (plantilla?.activo !== true) {
        throw new BadRequestException({
          mensaje: 'Revise los datos ingresados.',
          errores: [{ campo: 'plantillaId', mensaje: 'La plantilla no existe o está desactivada.' }],
        });
      }
    }

    if (entrada.etapaId !== null) {
      await this.validarEtapa(entrada, usuario, db);
    }

    if (entrada.clienteId !== null) {
      const cliente = await db.cliente.findUnique({
        where: { id: entrada.clienteId },
        select: {
          estado: true,
          asignaciones: { where: { usuarioId: usuario.usuarioId, retiradoEn: null }, select: { id: true } },
        },
      });

      if (cliente === null || cliente.estado === 'INACTIVO') {
        throw new BadRequestException({
          mensaje: 'Revise los datos ingresados.',
          errores: [{ campo: 'clienteId', mensaje: 'El cliente no existe o está inactivo.' }],
        });
      }

      if (!usuario.alcanceGlobal && cliente.asignaciones.length === 0) {
        throw new ForbiddenException({ mensaje: 'No tiene asignado este cliente.', errores: [] });
      }
    }

    await this.acceso.asegurarParticipante(entrada.responsableId, entrada.clienteId, 'responsableId', db);

    for (const colaboradorId of entrada.colaboradorIds) {
      await this.acceso.asegurarParticipante(colaboradorId, entrada.clienteId, 'colaboradorIds', db);
    }

    if (entrada.revisorId !== null) {
      const nombre = await this.acceso.asegurarParticipante(entrada.revisorId, entrada.clienteId, 'revisorId', db);

      if (!(await this.permisos.resolver(entrada.revisorId)).permisos.has('tarea:revisar')) {
        throw new BadRequestException({
          mensaje: 'Revise los datos ingresados.',
          errores: [{ campo: 'revisorId', mensaje: `${nombre} no tiene permiso para aprobar u observar tareas.` }],
        });
      }
    }
  }
}
