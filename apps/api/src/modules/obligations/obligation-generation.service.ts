import { Injectable } from '@nestjs/common';
import type { GrupoCronograma } from '@prisma/client';
import { ETIQUETAS_GRUPO_CRONOGRAMA, type MotivoOmision, type ResultadoGeneracion } from '@sige/types';
import { aFechaDb, aFechaIso, formatearFechaPeruana } from '../../common/dates';
import { esViolacionDeUnicidad } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActorAuditoria } from '../audit/audit.service';
import { AuditoriaService } from '../audit/audit.service';
import { NotificacionesService } from '../notifications/notifications.service';
import { generarCodigoTarea } from '../tasks/task-code';
import { ultimoDigitoRuc, vencimientoPorDia } from './obligation-rules';

const CODIGO_ROL_GERENCIA = 'GERENCIA';
const LARGO_MAXIMO_TITULO = 200;

interface Omision {
  cliente: string;
  tipoObligacion: string;
  motivo: MotivoOmision;
  detalle: string | null;
}

interface CronogramaFaltante {
  tipoObligacionId: string;
  tipoObligacion: string;
  grupo: GrupoCronograma;
}

@Injectable()
export class GeneracionObligacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  async generar(periodo: string, actor: ActorAuditoria): Promise<ResultadoGeneracion> {
    const configuradas = await this.prisma.obligacionCliente.findMany({
      where: {
        activo: true,
        desdePeriodo: { lte: periodo },
        OR: [{ hastaPeriodo: null }, { hastaPeriodo: { gte: periodo } }],
        tipoObligacion: { activo: true },
        cliente: { estado: 'ACTIVO' },
      },
      include: {
        tipoObligacion: { select: { id: true, codigo: true, nombre: true, usaCronograma: true, diaVencimiento: true } },
        cliente: { select: { id: true, razonSocial: true, ruc: true, grupoCronograma: true } },
        responsable: { select: { id: true, nombre: true } },
        revisor: { select: { id: true, nombre: true } },
      },
      orderBy: [{ cliente: { razonSocial: 'asc' } }, { tipoObligacion: { nombre: 'asc' } }],
    });

    const existentes = new Set(
      (
        await this.prisma.obligacionPeriodo.findMany({
          where: { periodo, obligacionClienteId: { in: configuradas.map(({ id }) => id) } },
          select: { obligacionClienteId: true },
        })
      ).map(({ obligacionClienteId }) => obligacionClienteId),
    );

    const fechasCronograma = new Map(
      (
        await this.prisma.cronogramaVencimiento.findMany({
          where: { periodo },
          select: { tipoObligacionId: true, grupo: true, ultimoDigito: true, fechaVencimiento: true },
        })
      ).map((fila) => [`${fila.tipoObligacionId}|${fila.grupo}|${String(fila.ultimoDigito)}`, aFechaIso(fila.fechaVencimiento)]),
    );

    const habilitados = new Map<string, boolean>();
    const omitidas: Omision[] = [];
    const faltantes = new Map<string, CronogramaFaltante>();
    const notificados: string[] = [];
    let generadas = 0;

    for (const obligacion of configuradas) {
      if (existentes.has(obligacion.id)) {
        continue;
      }

      const { tipoObligacion: tipo, cliente } = obligacion;
      const omitir = (motivo: MotivoOmision, detalle: string | null = null): void => {
        omitidas.push({ cliente: cliente.razonSocial, tipoObligacion: tipo.nombre, motivo, detalle });
      };
      let fechaVencimiento: string;

      if (tipo.usaCronograma) {
        const digito = ultimoDigitoRuc(cliente.ruc);

        if (digito === null) {
          omitir('SIN_RUC');
          continue;
        }

        const fecha = fechasCronograma.get(`${tipo.id}|${cliente.grupoCronograma}|${String(digito)}`);

        if (fecha === undefined) {
          omitir('SIN_CRONOGRAMA', `${ETIQUETAS_GRUPO_CRONOGRAMA[cliente.grupoCronograma]}, dígito ${String(digito)}`);
          faltantes.set(`${tipo.id}|${cliente.grupoCronograma}`, {
            tipoObligacionId: tipo.id,
            tipoObligacion: tipo.nombre,
            grupo: cliente.grupoCronograma,
          });
          continue;
        }

        fechaVencimiento = fecha;
      } else {
        fechaVencimiento = vencimientoPorDia(periodo, tipo.diaVencimiento ?? 1);
      }

      if (!(await this.habilitado(obligacion.responsable.id, cliente.id, habilitados))) {
        omitir('RESPONSABLE_NO_ASIGNADO', obligacion.responsable.nombre);
        continue;
      }

      if (obligacion.revisor !== null && !(await this.habilitado(obligacion.revisor.id, cliente.id, habilitados))) {
        omitir('REVISOR_NO_ASIGNADO', obligacion.revisor.nombre);
        continue;
      }

      const asignadorId = actor.usuarioId ?? obligacion.configuradoPorId;

      try {
        notificados.push(
          ...(await this.prisma.$transaction(async (tx) => {
            const codigo = await generarCodigoTarea(tx);
            const titulo = `${tipo.nombre} ${periodo} · ${cliente.razonSocial}`.slice(0, LARGO_MAXIMO_TITULO);
            const tarea = await tx.tarea.create({
              data: {
                codigo,
                titulo,
                instrucciones: `Obligación ${tipo.nombre} del periodo ${periodo}. Vence el ${formatearFechaPeruana(fechaVencimiento)}. Registre la presentación con su constancia desde la obligación.`,
                clienteId: cliente.id,
                responsableId: obligacion.responsable.id,
                revisorId: obligacion.revisor?.id ?? null,
                asignadoPorId: asignadorId,
                prioridad: 'ALTA',
                fechaLimite: aFechaDb(fechaVencimiento),
                requiereAprobacion: obligacion.revisor !== null,
                requiereEvidencia: true,
                evidenciaRequerida: 'Constancia de presentación',
              },
            });

            await tx.transicionTarea.create({
              data: { tareaId: tarea.id, hacia: 'PENDIENTE', usuarioId: asignadorId, comentario: 'Generada por la obligación del periodo' },
            });

            const generada = await tx.obligacionPeriodo.create({
              data: {
                obligacionClienteId: obligacion.id,
                periodo,
                fechaVencimiento: aFechaDb(fechaVencimiento),
                tareaId: tarea.id,
              },
            });

            await this.auditoria.registrar(
              {
                actor,
                accion: 'CREAR',
                entidad: 'obligacion_periodo',
                entidadId: generada.id,
                despues: { obligacionClienteId: obligacion.id, periodo, fechaVencimiento, tareaId: tarea.id, codigo },
              },
              tx,
            );

            return this.notificaciones.crear(
              {
                destinatarios: [obligacion.responsable.id, ...(obligacion.revisor === null ? [] : [obligacion.revisor.id])],
                tipo: 'TAREA_ASIGNADA',
                titulo: `Obligación del periodo: ${tipo.nombre}`,
                mensaje: `${cliente.razonSocial} · ${periodo} · Vence el ${formatearFechaPeruana(fechaVencimiento)}`,
                enlace: `/obligaciones/${generada.id}`,
                entidad: 'obligacion',
                entidadId: generada.id,
              },
              actor.usuarioId,
              tx,
            );
          })),
        );
        generadas += 1;
      } catch (error) {
        if (!esViolacionDeUnicidad(error)) {
          throw error;
        }
      }
    }

    notificados.push(...(await this.avisarCronogramaFaltante(periodo, [...faltantes.values()])));
    await this.notificaciones.publicar(notificados);

    return {
      periodo,
      generadas,
      existentes: existentes.size,
      omitidas,
    };
  }

  private async habilitado(usuarioId: string, clienteId: string, cache: Map<string, boolean>): Promise<boolean> {
    const clave = `${usuarioId}|${clienteId}`;
    const guardado = cache.get(clave);

    if (guardado !== undefined) {
      return guardado;
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        activo: true,
        roles: { where: { retiradoEn: null, rol: { activo: true, alcance: 'GLOBAL' } }, select: { id: true } },
        asignaciones: { where: { clienteId, retiradoEn: null }, select: { id: true } },
      },
    });
    const resultado =
      usuario !== null && usuario.activo && (usuario.roles.length > 0 || usuario.asignaciones.length > 0);

    cache.set(clave, resultado);
    return resultado;
  }

  private async avisarCronogramaFaltante(periodo: string, faltantes: CronogramaFaltante[]): Promise<string[]> {
    if (faltantes.length === 0) {
      return [];
    }

    const gerencia = await this.prisma.usuario.findMany({
      where: {
        activo: true,
        roles: { some: { retiradoEn: null, rol: { codigo: CODIGO_ROL_GERENCIA, activo: true } } },
      },
      select: { id: true },
    });
    const destinatarios = gerencia.map(({ id }) => id);
    const avisados: string[] = [];

    for (const faltante of faltantes) {
      avisados.push(
        ...(await this.notificaciones.crear(
          {
            destinatarios,
            tipo: 'CRONOGRAMA_FALTANTE',
            titulo: `Falta el cronograma de ${faltante.tipoObligacion}`,
            mensaje: `Periodo ${periodo} · ${ETIQUETAS_GRUPO_CRONOGRAMA[faltante.grupo]}. No se generaron esas obligaciones.`,
            enlace: `/configuracion/cronograma?anio=${periodo.slice(0, 4)}`,
            entidad: 'cronograma',
            entidadId: `${faltante.tipoObligacionId}:${periodo}:${faltante.grupo}`,
            claveDeduplicacion: (usuarioId) =>
              `CRONOGRAMA_FALTANTE:${faltante.tipoObligacionId}:${periodo}:${faltante.grupo}:${usuarioId}`,
          },
          null,
        )),
      );
    }

    return avisados;
  }
}
