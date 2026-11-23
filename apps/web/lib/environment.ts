import { z } from 'zod';

const esquemaEntorno = z.object({
  API_INTERNAL_URL: z.url(),
});

export type EntornoWeb = z.infer<typeof esquemaEntorno>;

export function leerEntorno(): EntornoWeb {
  const resultado = esquemaEntorno.safeParse(process.env);

  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((problema) => `${problema.path.join('.')}: ${problema.message}`)
      .join('; ');

    throw new Error(`Variables de entorno inválidas -> ${detalle}`);
  }

  return resultado.data;
}
