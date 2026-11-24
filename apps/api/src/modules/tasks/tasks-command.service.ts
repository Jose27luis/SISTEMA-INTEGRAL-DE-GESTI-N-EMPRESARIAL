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
import { aFechaDb, formatearFechaPeruana } from '../../common/dates';
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
} {
  return {
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
        data: { ...datosTarea(entrada), codigo, asignadoPorId: usuario.usuarioId },
      });

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

    await this.prisma.$transaction(async (tx) => {
      await this.cambiarEstado(id, 'INICIAR', usuario, contexto, 'Tarea iniciada', tx);
    });
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

  private async validar(entrada: TareaEntrada, usuario: UsuarioAutenticado, db: ClienteBaseDatos): Promise<void> {
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
