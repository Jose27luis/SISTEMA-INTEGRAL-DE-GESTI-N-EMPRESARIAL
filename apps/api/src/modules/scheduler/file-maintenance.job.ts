import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { VistasPreviasService } from '../uploads/previews.service';
import { SubidasService } from '../uploads/uploads.service';

const PROCESO_VISTAS = 'vistas-previas';
const PROCESO_SUBIDAS = 'limpieza-de-subidas';

@Injectable()
export class MantenimientoArchivosJob implements OnApplicationBootstrap {
  private readonly registro = new Logger(MantenimientoArchivosJob.name);
  private ocupado = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly vistas: VistasPreviasService,
    private readonly subidas: SubidasService,
  ) {}

  onApplicationBootstrap(): void {
    void this.convertir();
    void this.limpiarSubidas();
  }

  @Cron('*/20 * * * * *', { name: PROCESO_VISTAS })
  async convertir(): Promise<void> {
    if (this.ocupado) {
      return;
    }

    this.ocupado = true;

    try {
      await this.vistas.encolarFaltantes();
      const resultado = await this.vistas.procesarLote();

      if (resultado.listas + resultado.errores > 0) {
        await this.prisma.ejecucionProceso.create({
          data: {
            proceso: PROCESO_VISTAS,
            fin: new Date(),
            resultado: resultado.errores > 0 && resultado.listas === 0 ? 'ERROR' : 'CORRECTO',
            registros: resultado.listas,
            ...(resultado.errores > 0 ? { error: `${String(resultado.errores)} archivos no se pudieron convertir` } : {}),
          },
        });
      }
    } catch (error) {
      this.registro.error(`Falló ${PROCESO_VISTAS}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.ocupado = false;
    }
  }

  @Cron('0 15 * * * *', { name: PROCESO_SUBIDAS, timeZone: 'America/Lima' })
  async limpiarSubidas(): Promise<void> {
    const ejecucion = await this.prisma.ejecucionProceso.create({ data: { proceso: PROCESO_SUBIDAS } });

    try {
      const expiradas = await this.subidas.expirar();
      await this.prisma.ejecucionProceso.update({
        where: { id: ejecucion.id },
        data: { fin: new Date(), resultado: 'CORRECTO', registros: expiradas },
      });
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.registro.error(`Falló ${PROCESO_SUBIDAS}: ${mensaje}`);
      await this.prisma.ejecucionProceso.update({
        where: { id: ejecucion.id },
        data: { fin: new Date(), resultado: 'ERROR', error: mensaje.slice(0, 2000) },
      });
    }
  }
}
