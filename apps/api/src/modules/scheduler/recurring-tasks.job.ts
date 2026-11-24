import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { fechaHoyEnLima } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { GeneracionRecurrenteService } from '../templates/recurrence-generation.service';

const PROCESO = 'tareas-recurrentes';

@Injectable()
export class TareasRecurrentesJob implements OnApplicationBootstrap {
  private readonly registro = new Logger(TareasRecurrentesJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly generacion: GeneracionRecurrenteService,
  ) {}

  onApplicationBootstrap(): void {
    void this.ejecutar();
  }

  @Cron('0 30 5 * * *', { name: PROCESO, timeZone: 'America/Lima' })
  async ejecutar(): Promise<void> {
    const ejecucion = await this.prisma.ejecucionProceso.create({ data: { proceso: PROCESO } });

    try {
      const resultado = await this.generacion.generar(fechaHoyEnLima());

      await this.prisma.ejecucionProceso.update({
        where: { id: ejecucion.id },
        data: {
          fin: new Date(),
          resultado: 'CORRECTO',
          registros: resultado.generadas,
          ...(resultado.omitidas.length === 0 ? {} : { error: resultado.omitidas.join('; ').slice(0, 2000) }),
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
