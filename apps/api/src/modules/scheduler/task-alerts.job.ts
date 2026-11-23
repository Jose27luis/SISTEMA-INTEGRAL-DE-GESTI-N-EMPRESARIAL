import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ESTADOS_CERRADOS } from '@sige/types';
import { aFechaDb, aFechaIso, fechaHoyEnLima, formatearFechaPeruana } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificacionesService } from '../notifications/notifications.service';
import { claveAlerta, clasificarAlerta } from './alert-rules';

const PROCESO = 'alertas-de-tareas';
const CLAVE_BLOQUEO = 4_210_001;
const TIEMPO_MAXIMO_MS = 120_000;

function sumarUnDia(fecha: string): string {
  const siguiente = aFechaDb(fecha);
  siguiente.setUTCDate(siguiente.getUTCDate() + 1);
  return aFechaIso(siguiente);
}

@Injectable()
export class AlertasTareasJob implements OnApplicationBootstrap {
  private readonly registro = new Logger(AlertasTareasJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  onApplicationBootstrap(): void {
    void this.ejecutar();
  }

  @Cron('0 5 * * * *', { name: PROCESO, timeZone: 'America/Lima' })
  async ejecutar(): Promise<void> {
    const ejecucion = await this.prisma.ejecucionProceso.create({ data: { proceso: PROCESO } });

    try {
      const notificados = await this.prisma.$transaction(
        async (tx) => {
          const [bloqueo] = await tx.$queryRaw<{ tomado: boolean }[]>`SELECT pg_try_advisory_xact_lock(${CLAVE_BLOQUEO}) AS tomado`;

          if (bloqueo?.tomado !== true) {
            return null;
          }

          const hoy = fechaHoyEnLima();
          const manana = sumarUnDia(hoy);
          const tareas = await tx.tarea.findMany({
            where: { estado: { notIn: [...ESTADOS_CERRADOS] }, fechaLimite: { lte: aFechaDb(manana) } },
            select: { id: true, codigo: true, titulo: true, fechaLimite: true, responsableId: true, asignadoPorId: true },
          });

          const destinatarios: string[] = [];

          for (const tarea of tareas) {
            const fechaLimite = aFechaIso(tarea.fechaLimite);
            const tipo = clasificarAlerta(fechaLimite, hoy, manana);

            if (tipo === null) {
              continue;
            }

            const atrasada = tipo === 'TAREA_ATRASADA';

            destinatarios.push(
              ...(await this.notificaciones.crear(
                {
                  destinatarios: atrasada ? [tarea.responsableId, tarea.asignadoPorId] : [tarea.responsableId],
                  tipo,
                  titulo: atrasada ? `Tarea atrasada: ${tarea.titulo}` : `Tarea por vencer: ${tarea.titulo}`,
                  mensaje: `${tarea.codigo} · ${atrasada ? 'Venció' : 'Vence'} el ${formatearFechaPeruana(fechaLimite)}`,
                  enlace: `/tareas/${tarea.id}`,
                  entidad: 'tarea',
                  entidadId: tarea.id,
                  claveDeduplicacion: (usuarioId) => claveAlerta(tipo, tarea.id, fechaLimite, hoy, usuarioId),
                },
                null,
                tx,
              )),
            );
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
