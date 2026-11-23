import { z } from 'zod';

const esquemaEntorno = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().min(1),
  MFA_CLAVE_CIFRADO: z
    .string()
    .regex(/^[0-9a-f]{64}$/, 'Debe ser una clave hexadecimal de 64 caracteres'),
  SESION_DURACION_HORAS: z.coerce.number().int().min(1).max(24).default(8),
  SESION_INACTIVIDAD_MINUTOS: z.coerce.number().int().min(5).max(240).default(30),
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
