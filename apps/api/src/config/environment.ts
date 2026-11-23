import { z } from 'zod';

const esquemaEntorno = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().min(1),
});

export type Entorno = z.infer<typeof esquemaEntorno>;

export function cargarEntorno(): Entorno {
  const resultado = esquemaEntorno.safeParse(process.env);

  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((problema) => `${problema.path.join('.')}: ${problema.message}`)
      .join('; ');

    throw new Error(`Variables de entorno inválidas -> ${detalle}`);
  }

  return resultado.data;
}
