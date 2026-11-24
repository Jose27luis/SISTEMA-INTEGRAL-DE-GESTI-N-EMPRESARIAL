import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type CambioIncidencia,
  ESTADOS_CERRADOS,
  type EstadoIncidencia,
  type FichaOperativa,
  type Incidencia,
  type IncidenciaEntrada,
} from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb, aFechaIso, aIso, aIsoONulo, fechaHoyEnLima, formatearFechaPeruana } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
import { AccesoClientesService } from '../clients/client-access.service';
import { NotificacionesService } from '../notifications/notifications.service';
import { estadoObligacion, estaVencida } from '../obligations/obligation-rules';
import { AccesoTareasService } from '../tasks/task-access.service';

const MAXIMO_ACTIVIDADES = 10;

const TRANSICIONES: Record<EstadoIncidencia, readonly EstadoIncidencia[]> = {
  ABIERTA: ['EN_ATENCION', 'RESUELTA', 'ANULADA'],
  EN_ATENCION: ['RESUELTA', 'ANULADA'],
  RESUELTA: [],
  ANULADA: [],
};

export function transicionIncidenciaValida(desde: EstadoIncidencia, hacia: EstadoIncidencia): boolean {
  return TRANSICIONES[desde].includes(hacia);
}

@Injectable()
export class OperacionClienteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly accesoClientes: AccesoClientesService,
    private readonly accesoTareas: AccesoTareasService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  async ficha(clienteId: string, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<FichaOperativa> {
    await this.accesoClientes.asegurarAcceso(usuario, clienteId, contexto);
    const hoy = fechaHoyEnLima();
    const tareasVisibles = { AND: [{ clienteId }, this.accesoTareas.filtroVisible(usuario)] };
    const [obligaciones, esperados, actividades, tareasAbiertas, incidencias] = await Promise.all([
      this.prisma.obligacionCliente.findMany({
        where: { clienteId, activo: true },
        orderBy: { tipoObligacion: { nombre: 'asc' } },
        select: {
          tipoObligacion: { select: { nombre: true } },
          responsable: { select: { nombre: true } },
          periodos: {
            orderBy: { periodo: 'desc' },
            take: 1,
            select: { periodo: true, fechaVencimiento: true, fechaPresentacion: true, tarea: { select: { estado: true } } },
          },
        },
      }),
      this.prisma.documentoEsperado.findMany({
        where: { clienteId, anuladoEn: null },
        select: { documentoId: true, fechaLimite: true },
      }),
      this.prisma.tarea.findMany({
        where: { AND: [tareasVisibles, { completadaEn: { not: null } }] },
        orderBy: { completadaEn: 'desc' },
        take: MAXIMO_ACTIVIDADES,
        select: { id: true, codigo: true, titulo: true, completadaEn: true, responsable: { select: { nombre: true } } },
      }),
      this.prisma.tarea.count({ where: { AND: [tareasVisibles, { estado: { notIn: [...ESTADOS_CERRADOS] } }] } }),
      this.prisma.incidencia.findMany({
        where: { clienteId },
        orderBy: [{ fecha: 'desc' }, { registradaEn: 'desc' }],
        include: { responsable: { select: { id: true, nombre: true } }, registradaPor: { select: { nombre: true } } },
      }),
    ]);

    return {
      clienteId,
      obligaciones: obligaciones.map((obligacion) => {
        const ultimo = obligacion.periodos[0];
        const estado = ultimo === undefined ? null : estadoObligacion(ultimo.tarea.estado, ultimo.fechaPresentacion !== null);

        return {
          tipo: obligacion.tipoObligacion.nombre,
          responsable: obligacion.responsable.nombre,
          ultimoPeriodo: ultimo?.periodo ?? null,
          estado,
          vencida: ultimo !== undefined && estado !== null && estaVencida(estado, aFechaIso(ultimo.fechaVencimiento), hoy),
        };
      }),
      documentacion: {
        recibida: esperados.filter(({ documentoId }) => documentoId !== null).length,
        pendiente: esperados.filter(({ documentoId }) => documentoId === null).length,
        atrasada: esperados.filter(({ documentoId, fechaLimite }) => documentoId === null && aFechaIso(fechaLimite) < hoy).length,
      },
      actividades: actividades.flatMap((tarea) =>
        tarea.completadaEn === null
          ? []
          : [
              {
                tareaId: tarea.id,
                codigo: tarea.codigo,
                titulo: tarea.titulo,
                responsable: tarea.responsable.nombre,
                completadaEn: aIso(tarea.completadaEn),
              },
            ],
      ),
      tareasAbiertas,
      incidencias: incidencias.map((incidencia): Incidencia => ({
        id: incidencia.id,
        titulo: incidencia.titulo,
        descripcion: incidencia.descripcion,
        fecha: aFechaIso(incidencia.fecha),
        responsable: incidencia.responsable,
        estado: incidencia.estado,
        resolucion: incidencia.resolucion,
        resueltaEn: aIsoONulo(incidencia.resueltaEn),
        registradaPor: incidencia.registradaPor.nombre,
        registradaEn: aIso(incidencia.registradaEn),
      })),
      puedeGestionarIncidencias: usuario.permisos.has('incidencia:gestionar'),
    };
  }

  async registrarIncidencia(
    clienteId: string,
    entrada: IncidenciaEntrada,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    await this.accesoClientes.asegurarAcceso(usuario, clienteId, contexto);
    await this.accesoTareas.asegurarParticipante(entrada.responsableId, clienteId, 'responsableId', this.prisma);
    const cliente = await this.prisma.cliente.findUniqueOrThrow({ where: { id: clienteId }, select: { razonSocial: true } });

    const notificados = await this.prisma.$transaction(async (tx) => {
      const incidencia = await tx.incidencia.create({
        data: {
          clienteId,
          titulo: entrada.titulo,
          descripcion: entrada.descripcion,
          fecha: aFechaDb(entrada.fecha),
          responsableId: entrada.responsableId,
          registradaPorId: usuario.usuarioId,
        },
      });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'CREAR',
          entidad: 'incidencia',
          entidadId: incidencia.id,
          despues: { clienteId, ...entrada },
        },
        tx,
      );

      return this.notificaciones.crear(
        {
          destinatarios: [entrada.responsableId],
          tipo: 'INCIDENCIA_ASIGNADA',
          titulo: `Incidencia: ${entrada.titulo}`,
          mensaje: `${cliente.razonSocial} · ${formatearFechaPeruana(entrada.fecha)}`,
          enlace: `/clientes/${clienteId}/operacion`,
          entidad: 'incidencia',
          entidadId: incidencia.id,
        },
        usuario.usuarioId,
        tx,
      );
    });

    await this.notificaciones.publicar(notificados);
  }

  async cambiarEstado(
    clienteId: string,
    incidenciaId: string,
    entrada: CambioIncidencia,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    await this.accesoClientes.asegurarAcceso(usuario, clienteId, contexto);
    const incidencia = await this.prisma.incidencia.findFirst({ where: { id: incidenciaId, clienteId } });

    if (incidencia === null) {
      throw new NotFoundException({ mensaje: 'La incidencia no existe en este cliente.', errores: [] });
    }

    if (!transicionIncidenciaValida(incidencia.estado, entrada.estado)) {
      throw new ConflictException({ mensaje: 'La incidencia no admite ese cambio de estado.', errores: [] });
    }

    const cierra = entrada.estado === 'RESUELTA' || entrada.estado === 'ANULADA';

    await this.prisma.$transaction(async (tx) => {
      const actualizada = await tx.incidencia.updateMany({
        where: { id: incidenciaId, estado: incidencia.estado },
        data: {
          estado: entrada.estado,
          ...(cierra ? { resolucion: entrada.comentario, resueltaEn: new Date() } : {}),
        },
      });

      if (actualizada.count === 0) {
        throw new ConflictException({ mensaje: 'Otra persona cambió la incidencia. Recargue la página.', errores: [] });
      }

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'CAMBIAR_ESTADO',
          entidad: 'incidencia',
          entidadId: incidenciaId,
          antes: { estado: incidencia.estado },
          despues: { estado: entrada.estado },
          ...(entrada.comentario === null ? {} : { motivo: entrada.comentario }),
        },
        tx,
      );
    });
  }
}
