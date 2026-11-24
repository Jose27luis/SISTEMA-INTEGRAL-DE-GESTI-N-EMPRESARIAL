import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { fechaHoyEnLima } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { GeneracionObligacionesService } from '../obligations/obligation-generation.service';
import { periodoAGenerar } from '../obligations/obligation-rules';

const PROCESO = 'generacion-de-obligaciones';

@Injectable()
export class GeneracionObligacionesJob implements OnApplicationBootstrap {
  private readonly registro = new Logger(GeneracionObligacionesJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly generacion: GeneracionObligacionesService,
  ) {}

  onApplicationBootstrap(): void {
    void this.ejecutar();
  }

  @Cron('0 0 6 * * *', { name: PROCESO, timeZone: 'America/Lima' })
  async ejecutar(): Promise<void> {
    const ejecucion = await this.prisma.ejecucionProceso.create({ data: { proceso: PROCESO } });

    try {
      const periodo = periodoAGenerar(fechaHoyEnLima());
      const resultado = await this.generacion.generar(periodo, { usuarioId: null, sesionId: null, ip: null });

      await this.prisma.ejecucionProceso.update({
        where: { id: ejecucion.id },
        data: {
          fin: new Date(),
          resultado: 'CORRECTO',
          registros: resultado.generadas,
          ...(resultado.omitidas.length === 0
            ? {}
            : { error: `Periodo ${periodo}: ${String(resultado.omitidas.length)} obligaciones omitidas` }),
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
