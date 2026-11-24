import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { fechaHoyEnLima } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { GeneracionHonorariosService } from '../finance/fee-generation.service';

const PROCESO = 'generacion-de-honorarios';
const CLAVE_BLOQUEO = 4_210_005;
const TIEMPO_MAXIMO_MS = 120_000;

@Injectable()
export class HonorariosMensualesJob implements OnApplicationBootstrap {
  private readonly registro = new Logger(HonorariosMensualesJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly generacion: GeneracionHonorariosService,
  ) {}

  onApplicationBootstrap(): void {
    void this.ejecutar();
  }

  @Cron('0 10 6 * * *', { name: PROCESO, timeZone: 'America/Lima' })
  async ejecutar(): Promise<void> {
    const ejecucion = await this.prisma.ejecucionProceso.create({ data: { proceso: PROCESO } });

    try {
      const resultado = await this.prisma.$transaction(
        async (tx) => {
          const [bloqueo] = await tx.$queryRaw<{ tomado: boolean }[]>`SELECT pg_try_advisory_xact_lock(${CLAVE_BLOQUEO}) AS tomado`;

          if (bloqueo?.tomado !== true) {
            return null;
          }

          return this.generacion.generar(tx, fechaHoyEnLima().slice(0, 7));
        },
        { timeout: TIEMPO_MAXIMO_MS },
      );

      await this.prisma.ejecucionProceso.update({
        where: { id: ejecucion.id },
        data: {
          fin: new Date(),
          resultado: 'CORRECTO',
          registros: resultado?.generados ?? 0,
          ...(resultado === null ? { error: 'Omitido: otra instancia tenía el bloqueo' } : {}),
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
