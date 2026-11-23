import {
  Inject,
  Injectable,
  Logger,
  type MessageEvent,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Client } from 'pg';
import { filter, interval, map, merge, type Observable, Subject } from 'rxjs';
import type { Entorno } from '../../config/environment';
import { ENTORNO } from '../../config/environment.module';
import { CANAL_NOTIFICACIONES } from './notifications.service';

const INTERVALO_LATIDO_MS = 25_000;
const ESPERA_RECONEXION_MS = 5_000;

@Injectable()
export class FlujoNotificacionesService implements OnModuleInit, OnModuleDestroy {
  private readonly registro = new Logger(FlujoNotificacionesService.name);
  private readonly avisos = new Subject<string>();
  private cliente: Client | null = null;
  private cerrando = false;

  constructor(@Inject(ENTORNO) private readonly entorno: Entorno) {}

  async onModuleInit(): Promise<void> {
    await this.conectar();
  }

  async onModuleDestroy(): Promise<void> {
    this.cerrando = true;
    await this.cliente?.end();
  }

  flujo(usuarioId: string): Observable<MessageEvent> {
    return merge(
      this.avisos.pipe(
        filter((destinatario) => destinatario === usuarioId),
        map((): MessageEvent => ({ type: 'notificacion', data: { usuarioId } })),
      ),
      interval(INTERVALO_LATIDO_MS).pipe(map((): MessageEvent => ({ type: 'latido', data: {} }))),
    );
  }

  private async conectar(): Promise<void> {
    const cliente = new Client({ connectionString: this.entorno.DATABASE_URL });

    cliente.on('notification', (mensaje) => {
      if (mensaje.channel === CANAL_NOTIFICACIONES && mensaje.payload !== undefined) {
        this.avisos.next(mensaje.payload);
      }
    });

    cliente.on('error', (error) => {
      this.registro.error(`Conexión de notificaciones interrumpida: ${error.message}`);
      this.reconectar();
    });

    try {
      await cliente.connect();
      await cliente.query(`LISTEN ${CANAL_NOTIFICACIONES}`);
      this.cliente = cliente;
    } catch (error) {
      this.registro.error(`No se pudo escuchar notificaciones: ${error instanceof Error ? error.message : String(error)}`);
      this.reconectar();
    }
  }

  private reconectar(): void {
    if (this.cerrando) {
      return;
    }

    this.cliente = null;
    setTimeout(() => {
      void this.conectar();
    }, ESPERA_RECONEXION_MS);
  }
}
