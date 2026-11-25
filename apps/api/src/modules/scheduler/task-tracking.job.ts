import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ESTADOS_CERRADOS, HORAS_PARA_ACUSE } from '@sige/types';
import { aFechaIso, fechaHoyEnLima, formatearFechaPeruana, formatearPlazoPeruano } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificacionesService } from '../notifications/notifications.service';
import { evaluarSeguimiento } from '../tasks/task-tracking-rules';

const PROCESO = 'seguimiento-de-tareas';
const CLAVE_BLOQUEO = 4_210_007;
const TIEMPO_MAXIMO_MS = 120_000;

@Injectable()
export class SeguimientoTareasJob implements OnApplicationBootstrap {
  private readonly registro = new Logger(SeguimientoTareasJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  onApplicationBootstrap(): void {
    void this.ejecutar();
  }

  @Cron('0 5,20,35,50 * * * *', { name: PROCESO, timeZone: 'America/Lima' })
  async ejecutar(): Promise<void> {
    const ejecucion = await this.prisma.ejecucionProceso.create({ data: { proceso: PROCESO } });

    try {
      const notificados = await this.prisma.$transaction(
        async (tx) => {
          const [bloqueo] = await tx.$queryRaw<{ tomado: boolean }[]>`SELECT pg_try_advisory_xact_lock(${CLAVE_BLOQUEO}) AS tomado`;

          if (bloqueo?.tomado !== true) {
            return null;
          }

          const ahora = new Date();
          const hoy = fechaHoyEnLima();
          const tareas = await tx.tarea.findMany({
            where: { seguimientoEstricto: true, estado: { notIn: [...ESTADOS_CERRADOS] } },
            select: {
              id: true,
              codigo: true,
              titulo: true,
              estado: true,
              prioridad: true,
              fechaLimite: true,
              horaLimite: true,
              creadoEn: true,
              recibidaEn: true,
              ultimoReporteEn: true,
              responsableId: true,
              asignadoPorId: true,
              responsable: { select: { nombre: true } },
            },
          });
          const gerencia = await tx.usuario.findMany({
            where: {
              activo: true,
              roles: { some: { retiradoEn: null, rol: { codigo: 'GERENCIA', activo: true } } },
            },
            select: { id: true },
          });
          const destinatarios: string[] = [];

          for (const tarea of tareas) {
            const fechaLimite = aFechaIso(tarea.fechaLimite);
            const estado = evaluarSeguimiento(
              {
                estado: tarea.estado,
                prioridad: tarea.prioridad,
                fechaLimite,
                horaLimite: tarea.horaLimite,
                estricto: true,
                creadoEn: tarea.creadoEn,
                recibidaEn: tarea.recibidaEn,
                ultimoReporteEn: tarea.ultimoReporteEn,
              },
              ahora,
              hoy,
            );
            const enlace = `/tareas/${tarea.id}`;
            const avisar = async (
              para: readonly string[],
              tipo: 'TAREA_SIN_ACUSE' | 'TAREA_SIN_REPORTE' | 'TAREA_ESCALADA',
              titulo: string,
              mensaje: string,
              clave: string,
            ): Promise<void> => {
              destinatarios.push(
                ...(await this.notificaciones.crear(
                  {
                    destinatarios: para,
                    tipo,
                    titulo,
                    mensaje,
                    enlace,
                    entidad: 'tarea',
                    entidadId: tarea.id,
                    claveDeduplicacion: (usuarioId) => `${tipo}:${tarea.id}:${clave}:${usuarioId}`,
                  },
                  null,
                  tx,
                )),
              );
            };

            if (estado.sinAcuse) {
              await avisar(
                [tarea.asignadoPorId, tarea.responsableId],
                'TAREA_SIN_ACUSE',
                `Sin confirmar recepción: ${tarea.titulo}`,
                `${tarea.codigo} · ${tarea.responsable.nombre} no confirmó la tarea en ${String(HORAS_PARA_ACUSE)} horas.`,
                'unico',
              );
            }

            if (estado.sinReporte && estado.limiteReporte !== null) {
              await avisar(
                [tarea.responsableId, tarea.asignadoPorId],
                'TAREA_SIN_REPORTE',
                `Sin reporte de avance: ${tarea.titulo}`,
                `${tarea.codigo} · El último avance debía renovarse hasta el ${formatearFechaPeruana(estado.limiteReporte)}.`,
                estado.limiteReporte,
              );
            }

            if (estado.semaforo === 'VENCIDA' && gerencia.length > 0) {
              await avisar(
                gerencia.map(({ id }) => id),
                'TAREA_ESCALADA',
                `Tarea vencida: ${tarea.titulo}`,
                `${tarea.codigo} · Responsable ${tarea.responsable.nombre} · venció el ${formatearPlazoPeruano(fechaLimite, tarea.horaLimite)}.`,
                `${fechaLimite}${tarea.horaLimite === null ? '' : `T${tarea.horaLimite}`}`,
              );
            }
          }

          return destinatarios;
        },
        { timeout: TIEMPO_MAXIMO_MS },
      );

      if (notificados !== null) {
        await this.notificaciones.publicar(notificados);
      }

      await this.prisma.ejecucionProceso.update({
        where: { id: ejecucion.id },
        data: {
          fin: new Date(),
          resultado: 'CORRECTO',
          registros: notificados?.length ?? 0,
          ...(notificados === null ? { error: 'Omitido: otra instancia tenía el bloqueo' } : {}),
        },
      });
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.registro.error(`Falló ${PROCESO}: ${mensaje}`);
      await this.prisma.ejecucionProceso.update({
        where: { id: ejecucion.id },
        data: { fin: new Date(), resultado: 'ERROR', error: mensaje.slice(0, 2000) },
      });
    }
  }
}
