import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { aFechaDb, aFechaIso, fechaHoyEnLima, formatearFechaPeruana } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificacionesService } from '../notifications/notifications.service';

const PROCESO = 'revision-de-accesos';
const CLAVE_BLOQUEO = 4_210_004;
const TIEMPO_MAXIMO_MS = 120_000;

@Injectable()
export class RevisionAccesosJob implements OnApplicationBootstrap {
  private readonly registro = new Logger(RevisionAccesosJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  onApplicationBootstrap(): void {
    void this.ejecutar();
  }

  @Cron('0 35 * * * *', { name: PROCESO, timeZone: 'America/Lima' })
  async ejecutar(): Promise<void> {
    const ejecucion = await this.prisma.ejecucionProceso.create({ data: { proceso: PROCESO } });

    try {
      const notificados = await this.prisma.$transaction(
        async (tx) => {
          const [bloqueo] = await tx.$queryRaw<{ tomado: boolean }[]>`SELECT pg_try_advisory_xact_lock(${CLAVE_BLOQUEO}) AS tomado`;

          if (bloqueo?.tomado !== true) {
            return null;
          }

          const accesos = await tx.accesoPlataforma.findMany({
            where: { estado: 'ACTIVO', fechaRevision: { lt: aFechaDb(fechaHoyEnLima()) } },
            select: {
              id: true,
              clienteId: true,
              fechaRevision: true,
              responsableAutorizadoId: true,
              plataforma: { select: { nombre: true } },
              cliente: {
                select: {
                  razonSocial: true,
                  asignaciones: { where: { retiradoEn: null, rolEnCliente: 'RESPONSABLE' }, select: { usuarioId: true } },
                },
              },
            },
          });
          const destinatarios: string[] = [];

          for (const acceso of accesos) {
            const fecha = aFechaIso(acceso.fechaRevision);

            destinatarios.push(
              ...(await this.notificaciones.crear(
                {
                  destinatarios: [acceso.responsableAutorizadoId, ...acceso.cliente.asignaciones.map(({ usuarioId }) => usuarioId)],
                  tipo: 'ACCESO_POR_REVISAR',
                  titulo: `Revisar el acceso a ${acceso.plataforma.nombre}`,
                  mensaje: `${acceso.cliente.razonSocial} · la revisión venció el ${formatearFechaPeruana(fecha)}`,
                  enlace: `/clientes/${acceso.clienteId}/accesos`,
                  entidad: 'acceso_plataforma',
                  entidadId: acceso.id,
                  claveDeduplicacion: (usuarioId) => `ACCESO_POR_REVISAR:${acceso.id}:${fecha}:${usuarioId}`,
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
