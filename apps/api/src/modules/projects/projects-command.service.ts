import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  type CambioEstadoProyecto,
  type DificultadEntrada,
  ESTADOS_PROYECTO_CERRADOS,
  ETIQUETAS_ESTADO_PROYECTO,
  type ProyectoEntrada,
} from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb, aFechaIso, formatearFechaPeruana } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService, type ClienteBaseDatos } from '../audit/audit.service';
import { NotificacionesService } from '../notifications/notifications.service';
import { AccesoTareasService } from '../tasks/task-access.service';
import { formatearCodigoProyecto, transicionPermitida } from './project-rules';
import { ConsultaProyectosService, type ProyectoAccesible } from './projects-query.service';

function errorCampo(campo: string, mensaje: string): BadRequestException {
  return new BadRequestException({ mensaje: 'Revise los datos ingresados.', errores: [{ campo, mensaje }] });
}

@Injectable()
export class GestionProyectosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly notificaciones: NotificacionesService,
    private readonly accesoTareas: AccesoTareasService,
    private readonly consulta: ConsultaProyectosService,
  ) {}

  async crear(entrada: ProyectoEntrada, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<string> {
    await this.validar(entrada, usuario);
    const miembroIds = [...new Set(entrada.miembroIds)].filter((id) => id !== entrada.responsableId);
    const notificados: string[] = [];

    const id = await this.prisma.$transaction(async (tx) => {
      const [fila] = await tx.$queryRaw<{ numero: bigint }[]>`SELECT nextval('proyectos_codigo_seq') AS numero`;

      if (fila === undefined) {
        throw new Error('No se pudo generar el código del proyecto');
      }

      const codigo = formatearCodigoProyecto(new Date().getFullYear(), fila.numero);
      const proyecto = await tx.proyecto.create({
        data: { ...this.datos(entrada), codigo, creadoPorId: usuario.usuarioId },
      });

      if (miembroIds.length > 0) {
        await tx.miembroProyecto.createMany({ data: miembroIds.map((usuarioId) => ({ proyectoId: proyecto.id, usuarioId })) });
      }

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'CREAR',
          entidad: 'proyecto',
          entidadId: proyecto.id,
          despues: { codigo, ...entrada, miembroIds },
        },
        tx,
      );

      notificados.push(
        ...(await this.avisarEquipo(tx, [entrada.responsableId, ...miembroIds], proyecto.id, codigo, entrada, usuario.usuarioId)),
      );

      return proyecto.id;
    });

    await this.notificaciones.publicar(notificados);
    return id;
  }

  async editar(id: string, entrada: ProyectoEntrada, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<void> {
    const proyecto = await this.asegurarGestion(id, usuario, contexto);
    this.asegurarAbierto(proyecto);
    await this.validar(entrada, usuario);

    const anterior = await this.prisma.proyecto.findUniqueOrThrow({
      where: { id },
      include: { miembros: { where: { retiradoEn: null }, select: { id: true, usuarioId: true } } },
    });

    if (entrada.clienteId !== anterior.clienteId) {
      const tareas = await this.prisma.tarea.count({ where: { etapa: { proyectoId: id } } });

      if (tareas > 0) {
        throw errorCampo('clienteId', 'No se puede cambiar el cliente de un proyecto que ya tiene tareas.');
      }
    }

    const nuevos = [...new Set(entrada.miembroIds)].filter((usuarioId) => usuarioId !== entrada.responsableId);
    const actuales = anterior.miembros.map(({ usuarioId }) => usuarioId);
    const agregados = nuevos.filter((usuarioId) => !actuales.includes(usuarioId));
    const retirados = anterior.miembros.filter(({ usuarioId }) => !nuevos.includes(usuarioId));
    const notificados: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      await tx.proyecto.update({ where: { id }, data: this.datos(entrada) });

      if (retirados.length > 0) {
        await tx.miembroProyecto.updateMany({
          where: { id: { in: retirados.map(({ id: miembroId }) => miembroId) } },
          data: { retiradoEn: new Date() },
        });
      }

      if (agregados.length > 0) {
        await tx.miembroProyecto.createMany({ data: agregados.map((usuarioId) => ({ proyectoId: id, usuarioId })) });
      }

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'MODIFICAR',
          entidad: 'proyecto',
          entidadId: id,
          antes: {
            nombre: anterior.nombre,
            clienteId: anterior.clienteId,
            responsableId: anterior.responsableId,
            fechaInicio: aFechaIso(anterior.fechaInicio),
            fechaEntrega: aFechaIso(anterior.fechaEntrega),
            presupuesto: anterior.presupuesto === null ? null : Number(anterior.presupuesto),
            honorarios: anterior.honorarios === null ? null : Number(anterior.honorarios),
            miembroIds: actuales,
          },
          despues: { ...entrada, miembroIds: nuevos },
        },
        tx,
      );

      const avisar = [...agregados, ...(entrada.responsableId === anterior.responsableId ? [] : [entrada.responsableId])];
      notificados.push(...(await this.avisarEquipo(tx, avisar, id, anterior.codigo, entrada, usuario.usuarioId)));
    });

    await this.notificaciones.publicar(notificados);
  }

  async cambiarEstado(
    id: string,
    entrada: CambioEstadoProyecto,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const proyecto = await this.asegurarGestion(id, usuario, contexto);

    if (!transicionPermitida(proyecto.estado, entrada.estado)) {
      throw new ConflictException({
        mensaje: `Un proyecto ${ETIQUETAS_ESTADO_PROYECTO[proyecto.estado].toLowerCase()} no puede pasar a ${ETIQUETAS_ESTADO_PROYECTO[entrada.estado].toLowerCase()}.`,
        errores: [],
      });
    }

    const cierra = ESTADOS_PROYECTO_CERRADOS.includes(entrada.estado);

    if (entrada.estado === 'FINALIZADO') {
      const abiertas = await this.prisma.tarea.count({
        where: { etapa: { proyectoId: id }, estado: { notIn: ['APROBADA', 'FINALIZADA', 'CANCELADA'] } },
      });

      if (abiertas > 0) {
        throw new ConflictException({
          mensaje: `Quedan ${String(abiertas)} ${abiertas === 1 ? 'tarea abierta' : 'tareas abiertas'}. Ciérrelas o cancélelas antes de finalizar.`,
          errores: [],
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.proyecto.updateMany({
        where: { id, estado: proyecto.estado },
        data: {
          estado: entrada.estado,
          ...(cierra ? { cerradoEn: new Date(), resultadoFinal: entrada.comentario, conDificultades: false, detalleDificultad: null } : {}),
        },
      });

      if (count === 0) {
        throw new ConflictException({ mensaje: 'El proyecto cambió mientras lo editaba. Recargue la página.', errores: [] });
      }

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'CAMBIAR_ESTADO',
          entidad: 'proyecto',
          entidadId: id,
          antes: { estado: proyecto.estado },
          despues: { estado: entrada.estado },
          ...(entrada.comentario === null ? {} : { motivo: entrada.comentario }),
        },
        tx,
      );
    });
  }

  async marcarDificultad(
    id: string,
    entrada: DificultadEntrada,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const proyecto = await this.consulta.obtenerVisible(id, usuario, contexto);
    this.asegurarAbierto(proyecto);

    if (!usuario.alcanceGlobal && !proyecto.equipo.has(usuario.usuarioId)) {
      throw new ForbiddenException({ mensaje: 'Solo el equipo del proyecto puede reportar dificultades.', errores: [] });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.proyecto.update({
        where: { id },
        data: { conDificultades: entrada.conDificultades, detalleDificultad: entrada.conDificultades ? entrada.detalle : null },
      });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'MODIFICAR',
          entidad: 'proyecto',
          entidadId: id,
          despues: { conDificultades: entrada.conDificultades, detalle: entrada.detalle },
          motivo: entrada.conDificultades ? 'Dificultad reportada' : 'Dificultad resuelta',
        },
        tx,
      );
    });
  }

  async asegurarGestion(id: string, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<ProyectoAccesible> {
    const proyecto = await this.consulta.obtenerVisible(id, usuario, contexto);

    if (!usuario.alcanceGlobal && proyecto.responsableId !== usuario.usuarioId) {
      throw new ForbiddenException({ mensaje: 'Solo el responsable del proyecto o Gerencia pueden hacer este cambio.', errores: [] });
    }

    return proyecto;
  }

  asegurarAbierto(proyecto: ProyectoAccesible): void {
    if (ESTADOS_PROYECTO_CERRADOS.includes(proyecto.estado)) {
      throw new ConflictException({ mensaje: 'El proyecto está cerrado y no admite cambios.', errores: [] });
    }
  }

  private datos(entrada: ProyectoEntrada): {
    nombre: string;
    clienteId: string | null;
    servicioId: string | null;
    descripcion: string | null;
    objetivo: string | null;
    responsableId: string;
    presupuesto: number | null;
    honorarios: number | null;
    fechaInicio: Date;
    fechaEntrega: Date;
  } {
    return {
      nombre: entrada.nombre,
      clienteId: entrada.clienteId,
      servicioId: entrada.servicioId,
      descripcion: entrada.descripcion,
      objetivo: entrada.objetivo,
      responsableId: entrada.responsableId,
      presupuesto: entrada.presupuesto,
      honorarios: entrada.honorarios,
      fechaInicio: aFechaDb(entrada.fechaInicio),
      fechaEntrega: aFechaDb(entrada.fechaEntrega),
    };
  }

  private async validar(entrada: ProyectoEntrada, usuario: UsuarioAutenticado): Promise<void> {
    if (entrada.clienteId !== null) {
      const cliente = await this.prisma.cliente.findUnique({
        where: { id: entrada.clienteId },
        select: {
          estado: true,
          asignaciones: { where: { usuarioId: usuario.usuarioId, retiradoEn: null }, select: { id: true } },
        },
      });

      if (cliente === null || cliente.estado === 'INACTIVO') {
        throw errorCampo('clienteId', 'El cliente no existe o está inactivo.');
      }

      if (!usuario.alcanceGlobal && cliente.asignaciones.length === 0) {
        throw new ForbiddenException({ mensaje: 'No tiene asignado este cliente.', errores: [] });
      }
    }

    if (entrada.servicioId !== null) {
      const servicio = await this.prisma.servicio.findUnique({ where: { id: entrada.servicioId }, select: { activo: true } });

      if (servicio?.activo !== true) {
        throw errorCampo('servicioId', 'Seleccione un servicio activo.');
      }
    }

    await this.accesoTareas.asegurarParticipante(entrada.responsableId, entrada.clienteId, 'responsableId', this.prisma);

    for (const miembroId of entrada.miembroIds) {
      await this.accesoTareas.asegurarParticipante(miembroId, entrada.clienteId, 'miembroIds', this.prisma);
    }
  }

  private async avisarEquipo(
    tx: ClienteBaseDatos,
    destinatarios: readonly string[],
    proyectoId: string,
    codigo: string,
    entrada: ProyectoEntrada,
    actorId: string,
  ): Promise<string[]> {
    if (destinatarios.length === 0) {
      return [];
    }

    return this.notificaciones.crear(
      {
        destinatarios,
        tipo: 'PROYECTO_ASIGNADO',
        titulo: `Proyecto: ${entrada.nombre}`,
        mensaje: `${codigo} · Entrega el ${formatearFechaPeruana(entrada.fechaEntrega)}`,
        enlace: `/proyectos/${proyectoId}`,
        entidad: 'proyecto',
        entidadId: proyectoId,
      },
      actorId,
      tx,
    );
  }
}
