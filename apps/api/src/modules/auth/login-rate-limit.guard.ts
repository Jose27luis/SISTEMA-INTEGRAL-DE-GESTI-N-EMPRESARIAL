import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { z } from 'zod';

const esquemaSolicitudRastreable = z.object({
  ip: z.string().optional(),
  headers: z.object({ 'x-cliente-ip': z.string().optional() }),
});

@Injectable()
export class GuardiaLimiteIngreso extends ThrottlerGuard {
  protected override getTracker(solicitud: Record<string, unknown>): Promise<string> {
    const resultado = esquemaSolicitudRastreable.safeParse(solicitud);

    if (!resultado.success) {
      return Promise.resolve('desconocido');
    }

    return Promise.resolve(resultado.data.headers['x-cliente-ip'] ?? resultado.data.ip ?? 'desconocido');
  }
}
