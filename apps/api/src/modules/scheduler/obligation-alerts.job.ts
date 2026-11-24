import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ESTADOS_CERRADOS } from '@sige/types';
import { aFechaDb, aFechaIso, fechaHoyEnLima, formatearFechaPeruana } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificacionesService } from '../notifications/notifications.service';
import { claveAlertaObligacion, clasificarAlertaObligacion } from '../obligations/obligation-rules';

const PROCESO = 'alertas-de-obligaciones';
const CLAVE_BLOQUEO = 4_210_002;
const TIEMPO_MAXIMO_MS = 120_000;
const DIAS_MAXIMOS_DE_AVISO = 30;

function sumarDias(fecha: string, dias: number): string {
  const resultado = aFechaDb(fecha);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return aFechaIso(resultado);
}

@Injectable()
export class AlertasObligacionesJob implements OnApplicationBootstrap {
  private readonly registro = new Logger(AlertasObligacionesJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  onApplicationBootstrap(): void {
    void this.ejecutar();
  }

  @Cron('0 15 * * * *', { name: PROCESO, timeZone: 'America/Lima' })
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
          const obligaciones = await tx.obligacionPeriodo.findMany({
            where: {
              fechaPresentacion: null,
              fechaVencimiento: { lte: aFechaDb(sumarDias(hoy, DIAS_MAXIMOS_DE_AVISO)) },
              tarea: { estado: { notIn: [...ESTADOS_CERRADOS] } },
            },
            select: {
              id: true,
              periodo: true,
              fechaVencimiento: true,
              obligacionCliente: {
                select: {
                  responsableId: true,
                  revisorId: true,
                  tipoObligacion: { select: { nombre: true, diasAlerta: true } },
                  cliente: { select: { razonSocial: true } },
                },
              },
            },
          });
          const destinatarios: string[] = [];

          for (const obligacion of obligaciones) {
            const fechaVencimiento = aFechaIso(obligacion.fechaVencimiento);
            const { responsableId, revisorId, tipoObligacion, cliente } = obligacion.obligacionCliente;
            const tipo = clasificarAlertaObligacion(fechaVencimiento, hoy, tipoObligacion.diasAlerta);

            if (tipo === null) {
              continue;
            }

            const vencida = tipo === 'OBLIGACION_VENCIDA';

            destinatarios.push(
              ...(await this.notificaciones.crear(
                {
                  destinatarios: revisorId === null ? [responsableId] : [responsableId, revisorId],
                  tipo,
                  titulo: `${vencida ? 'Obligación vencida' : 'Obligación por vencer'}: ${tipoObligacion.nombre}`,
                  mensaje: `${cliente.razonSocial} · ${obligacion.periodo} · ${vencida ? 'Venció' : 'Vence'} el ${formatearFechaPeruana(fechaVencimiento)}`,
                  enlace: `/obligaciones/${obligacion.id}`,
                  entidad: 'obligacion',
                  entidadId: obligacion.id,
                  claveDeduplicacion: (usuarioId) =>
                    claveAlertaObligacion(tipo, obligacion.id, fechaVencimiento, hoy, usuarioId),
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
