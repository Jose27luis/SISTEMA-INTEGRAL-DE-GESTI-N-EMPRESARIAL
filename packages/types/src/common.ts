import { z } from 'zod';

export const esquemaErrorCampo = z.object({
  campo: z.string(),
  mensaje: z.string(),
});

export const esquemaErrorApi = z.object({
  mensaje: z.string(),
  errores: z.array(esquemaErrorCampo).default([]),
});

export const esquemaMotivo = z.object({
  motivo: z.string().trim().min(5).max(500),
});

export const esquemaMetadatosPagina = z.object({
  total: z.number().int().nonnegative(),
  pagina: z.number().int().positive(),
  porPagina: z.number().int().positive(),
});

export type ErrorCampo = z.infer<typeof esquemaErrorCampo>;
export type ErrorApi = z.infer<typeof esquemaErrorApi>;
export type Motivo = z.infer<typeof esquemaMotivo>;

export interface Pagina<T> {
  elementos: T[];
  total: number;
  pagina: number;
  porPagina: number;
}
