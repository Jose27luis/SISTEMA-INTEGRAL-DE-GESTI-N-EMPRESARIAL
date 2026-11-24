import { Injectable } from '@nestjs/common';
import { aFechaDb, aFechaIso, aFechaIsoONula, formatearFechaPeruana } from '../../common/dates';
import { esViolacionDeUnicidad } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../audit/audit.service';
import { NotificacionesService } from '../notifications/notifications.service';
import { generarCodigoTarea } from '../tasks/task-code';
import { DIAS_DE_RECUPERACION, ocurrenciasEntre, sumarDias } from './recurrence-rules';

const LARGO_MAXIMO_TITULO = 200;

export interface ResultadoRecurrencia {
  generadas: number;
  omitidas: string[];
}

@Injectable()
export class GeneracionRecurrenteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  async generar(hoy: string): Promise<ResultadoRecurrencia> {
    const reglas = await this.prisma.reglaRecurrencia.findMany({
      where: {
        activo: true,
        plantilla: { activo: true },
        vigenteDesde: { lte: aFechaDb(hoy) },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: aFechaDb(sumarDias(hoy, -DIAS_DE_RECUPERACION)) } }],
      },
      include: {
        plantilla: true,
        cliente: { select: { id: true, razonSocial: true, estado: true } },
        responsable: { select: { id: true, nombre: true } },
        revisor: { select: { id: true, nombre: true } },
      },
    });
    const omitidas: string[] = [];
    const notificados: string[] = [];
    let generadas = 0;

    for (const regla of reglas) {
      const fechas = ocurrenciasEntre(
        {
          frecuencia: regla.frecuencia,
          diaDelMes: regla.diaDelMes,
          diaDeSemana: regla.diaDeSemana,
          vigenteDesde: aFechaIso(regla.vigenteDesde),
          vigenteHasta: aFechaIsoONula(regla.vigenteHasta),
        },
        sumarDias(hoy, -DIAS_DE_RECUPERACION),
        hoy,
      );

      if (fechas.length === 0) {
        continue;
      }

      if (regla.cliente !== null && regla.cliente.estado === 'INACTIVO') {
        omitidas.push(`${regla.plantilla.nombre}: el cliente ${regla.cliente.razonSocial} está inactivo`);
        continue;
      }

      const habilitados = await this.habilitados(
        [regla.responsable.id, ...(regla.revisor === null ? [] : [regla.revisor.id])],
        regla.cliente?.id ?? null,
      );

      if (!habilitados) {
        omitidas.push(`${regla.plantilla.nombre}: el responsable o el revisor ya no está activo o asignado al cliente`);
        continue;
      }

      const existentes = new Set(
        (
          await this.prisma.tarea.findMany({
            where: { reglaId: regla.id, fechaOcurrencia: { in: fechas.map(aFechaDb) } },
            select: { fechaOcurrencia: true },
          })
        ).flatMap(({ fechaOcurrencia }) => (fechaOcurrencia === null ? [] : [aFechaIso(fechaOcurrencia)])),
      );

      for (const fecha of fechas.filter((ocurrencia) => !existentes.has(ocurrencia))) {
        const fechaLimite = sumarDias(fecha, regla.plantilla.diasPlazo);

        try {
          notificados.push(
            ...(await this.prisma.$transaction(async (tx) => {
              const codigo = await generarCodigoTarea(tx);
              const titulo = `${regla.plantilla.titulo}${regla.cliente === null ? '' : ` · ${regla.cliente.razonSocial}`}`.slice(
                0,
                LARGO_MAXIMO_TITULO,
              );
              const tarea = await tx.tarea.create({
                data: {
                  codigo,
                  titulo,
                  instrucciones: regla.plantilla.instrucciones,
                  clienteId: regla.cliente?.id ?? null,
                  responsableId: regla.responsable.id,
                  revisorId: regla.revisor?.id ?? null,
                  asignadoPorId: regla.creadoPorId,
                  prioridad: regla.plantilla.prioridad,
                  fechaInicio: aFechaDb(fecha),
                  fechaLimite: aFechaDb(fechaLimite),
                  requiereAprobacion: regla.plantilla.requiereAprobacion && regla.revisor !== null,
                  requiereEvidencia: regla.plantilla.requiereEvidencia,
                  evidenciaRequerida: regla.plantilla.evidenciaRequerida,
                  plantillaId: regla.plantilla.id,
                  reglaId: regla.id,
                  fechaOcurrencia: aFechaDb(fecha),
                },
              });

              if (regla.plantilla.items.length > 0) {
                await tx.itemVerificacion.createMany({
                  data: regla.plantilla.items.map((texto, orden) => ({ tareaId: tarea.id, texto, orden })),
                });
              }

              await tx.transicionTarea.create({
                data: {
                  tareaId: tarea.id,
                  hacia: 'PENDIENTE',
                  usuarioId: regla.creadoPorId,
                  comentario: 'Generada por una tarea recurrente',
                },
              });

              await this.auditoria.registrar(
                {
                  actor: { usuarioId: null, sesionId: null, ip: null },
                  accion: 'CREAR',
                  entidad: 'tarea',
                  entidadId: tarea.id,
                  despues: { codigo, reglaId: regla.id, fechaOcurrencia: fecha, fechaLimite },
                  motivo: 'Tarea recurrente',
                },
                tx,
              );

              return this.notificaciones.crear(
                {
                  destinatarios: [regla.responsable.id],
                  tipo: 'TAREA_ASIGNADA',
                  titulo: `Nueva tarea: ${titulo}`,
                  mensaje: `${codigo} · Recurrente · Vence el ${formatearFechaPeruana(fechaLimite)}`,
                  enlace: `/tareas/${tarea.id}`,
                  entidad: 'tarea',
                  entidadId: tarea.id,
                },
                null,
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
    }

    await this.notificaciones.publicar(notificados);
    return { generadas, omitidas };
  }

  private async habilitados(usuarioIds: readonly string[], clienteId: string | null): Promise<boolean> {
    for (const usuarioId of usuarioIds) {
      const usuario = await this.prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: {
          activo: true,
          roles: { where: { retiradoEn: null, rol: { activo: true, alcance: 'GLOBAL' } }, select: { id: true } },
        },
      });

      if (usuario?.activo !== true) {
        return false;
      }

      if (clienteId !== null && usuario.roles.length === 0) {
        const asignado = await this.prisma.asignacionCliente.count({ where: { usuarioId, clienteId, retiradoEn: null } });

        if (asignado === 0) {
          return false;
        }
      }
    }

    return true;
  }
}
