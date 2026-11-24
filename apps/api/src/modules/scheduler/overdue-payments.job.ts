import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { aFechaDb, aFechaIso, fechaHoyEnLima, formatearFechaPeruana } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { diasDeAtraso } from '../finance/finance-rules';
import { NotificacionesService } from '../notifications/notifications.service';

const PROCESO = 'recordatorio-de-pagos-vencidos';
const CLAVE_BLOQUEO = 4_210_006;
const TIEMPO_MAXIMO_MS = 120_000;
const DIAS_DE_AVISO = new Set([1, 7, 15, 30]);
const CADA_DIAS_DESPUES = 30;

export function tocaRecordatorio(dias: number): boolean {
  return DIAS_DE_AVISO.has(dias) || (dias > 30 && dias % CADA_DIAS_DESPUES === 0);
}

@Injectable()
export class PagosVencidosJob implements OnApplicationBootstrap {
  private readonly registro = new Logger(PagosVencidosJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  onApplicationBootstrap(): void {
    void this.ejecutar();
  }

  @Cron('0 15 8 * * *', { name: PROCESO, timeZone: 'America/Lima' })
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
          const responsables = await tx.usuario.findMany({
            where: {
              activo: true,
              roles: {
                some: {
                  retiradoEn: null,
                  rol: {
                    activo: true,
                    permisos: { some: { retiradoEn: null, permiso: { codigo: 'finanza:ingresos' } } },
                  },
                },
              },
            },
            select: { id: true },
          });

          if (responsables.length === 0) {
            return [];
          }

          const vencidos = await tx.ingreso.findMany({
            where: { anuladoEn: null, saldo: { gt: 0 }, fechaVencimiento: { lt: aFechaDb(hoy) } },
            select: {
              id: true,
              concepto: true,
              saldo: true,
              fechaVencimiento: true,
              cliente: { select: { razonSocial: true } },
            },
          });
          const destinatarios: string[] = [];

          for (const ingreso of vencidos) {
            const vencimiento = aFechaIso(ingreso.fechaVencimiento);
            const dias = diasDeAtraso(vencimiento, hoy, Number(ingreso.saldo), false);

            if (!tocaRecordatorio(dias)) {
              continue;
            }

            destinatarios.push(
              ...(await this.notificaciones.crear(
                {
                  destinatarios: responsables.map(({ id }) => id),
                  tipo: 'PAGO_VENCIDO',
                  titulo: `Pago vencido de ${ingreso.cliente.razonSocial}`,
                  mensaje: `${ingreso.concepto} · saldo S/ ${Number(ingreso.saldo).toFixed(2)} · venció el ${formatearFechaPeruana(vencimiento)} (${String(dias)} días)`,
                  enlace: `/finanzas/ingresos/${ingreso.id}`,
                  entidad: 'ingreso',
                  entidadId: ingreso.id,
                  claveDeduplicacion: (usuarioId) => `PAGO_VENCIDO:${ingreso.id}:${String(dias)}:${usuarioId}`,
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
