import { z } from 'zod';

export const esquemaEstadoComponente = z.enum(['ok', 'error']);

export const esquemaEstadoSalud = z.object({
  servicio: z.literal('ok'),
  baseDatos: esquemaEstadoComponente,
});

export type EstadoComponente = z.infer<typeof esquemaEstadoComponente>;

export type EstadoSalud = z.infer<typeof esquemaEstadoSalud>;
