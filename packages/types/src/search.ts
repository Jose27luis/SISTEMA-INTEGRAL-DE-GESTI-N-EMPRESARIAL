import { z } from 'zod';

export const LARGO_MINIMO_BUSQUEDA = 2;

export const esquemaBusquedaEntrada = z.object({
  q: z.string().trim().min(LARGO_MINIMO_BUSQUEDA, 'Escriba al menos 2 caracteres.').max(100),
});

export type BusquedaEntrada = z.infer<typeof esquemaBusquedaEntrada>;

export const esquemaResultadosBusqueda = z.object({
  consulta: z.string(),
  clientes: z.array(z.object({ id: z.uuid(), razonSocial: z.string(), documento: z.string().nullable() })),
  tareas: z.array(z.object({ id: z.uuid(), codigo: z.string(), titulo: z.string(), cliente: z.string().nullable() })),
  documentos: z.array(z.object({ id: z.uuid(), titulo: z.string(), tipo: z.string(), cliente: z.string().nullable() })),
  proyectos: z.array(z.object({ id: z.uuid(), codigo: z.string(), nombre: z.string(), cliente: z.string().nullable() })),
});

export type ResultadosBusqueda = z.infer<typeof esquemaResultadosBusqueda>;

export const esquemaEjecucion = z.object({
  id: z.uuid(),
  proceso: z.string(),
  inicio: z.iso.datetime(),
  fin: z.iso.datetime().nullable(),
  resultado: z.enum(['EN_CURSO', 'CORRECTO', 'ERROR']),
  registros: z.number().int(),
  error: z.string().nullable(),
});

export type Ejecucion = z.infer<typeof esquemaEjecucion>;

export const esquemaFiltroEjecuciones = z.object({
  proceso: z
    .string()
    .trim()
    .max(80)
    .transform((valor) => (valor === '' ? undefined : valor))
    .optional(),
  resultado: z
    .string()
    .trim()
    .transform((valor) => (valor === '' ? undefined : valor))
    .pipe(z.enum(['EN_CURSO', 'CORRECTO', 'ERROR']).optional())
    .optional(),
});

export type FiltroEjecuciones = z.infer<typeof esquemaFiltroEjecuciones>;

export const esquemaListaEjecuciones = z.object({
  procesos: z.array(
    z.object({ proceso: z.string(), ultima: esquemaEjecucion, errores24h: z.number().int().nonnegative() }),
  ),
  ejecuciones: z.array(esquemaEjecucion),
});

export type ListaEjecuciones = z.infer<typeof esquemaListaEjecuciones>;

export const esquemaReporteClientes = z.object({
  periodo: z.string(),
  filas: z.array(
    z.object({
      cliente: z.string(),
      documento: z.string().nullable(),
      estado: z.string(),
      regimen: z.string().nullable(),
      obligacionesConfiguradas: z.number().int(),
      cumplidas: z.number().int(),
      pendientes: z.number().int(),
      vencidas: z.number().int(),
      documentacionFaltante: z.number().int(),
      incidenciasAbiertas: z.number().int(),
    }),
  ),
});

export type ReporteClientes = z.infer<typeof esquemaReporteClientes>;
