import { z } from 'zod';
import { esquemaTareaResumen } from './tasks';

export const MAXIMO_DIAS_PERIODO = 366;

const vacioAIndefinido = z
  .string()
  .trim()
  .transform((valor) => (valor === '' ? undefined : valor));

function diasEntre(desde: string, hasta: string): number {
  return (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000;
}

export const esquemaFiltroPeriodo = z
  .object({
    desde: z.iso.date('Ingrese la fecha inicial.'),
    hasta: z.iso.date('Ingrese la fecha final.'),
    areaId: vacioAIndefinido.pipe(z.uuid().optional()).optional(),
    usuarioId: vacioAIndefinido.pipe(z.uuid().optional()).optional(),
  })
  .superRefine((filtro, contexto) => {
    if (filtro.desde > filtro.hasta) {
      contexto.addIssue({
        code: 'custom',
        path: ['hasta'],
        message: 'La fecha final no puede ser anterior a la inicial.',
      });
    } else if (diasEntre(filtro.desde, filtro.hasta) >= MAXIMO_DIAS_PERIODO) {
      contexto.addIssue({ code: 'custom', path: ['hasta'], message: 'El periodo no puede superar un año.' });
    }
  });

export const FORMATOS_EXPORTACION = ['xlsx', 'pdf'] as const;

export const esquemaFormatoExportacion = z.enum(FORMATOS_EXPORTACION);

export type FormatoExportacion = z.infer<typeof esquemaFormatoExportacion>;

const esquemaPersona = z.object({ id: z.uuid(), nombre: z.string() });

export const esquemaConteoTareas = z.object({
  asignadas: z.number().int().nonnegative(),
  terminadas: z.number().int().nonnegative(),
  aprobadas: z.number().int().nonnegative(),
  observadas: z.number().int().nonnegative(),
  abiertas: z.number().int().nonnegative(),
  atrasadas: z.number().int().nonnegative(),
  minutos: z.number().int().nonnegative(),
  cumplimiento: z.number().int().min(0).max(100).nullable(),
});

export const esquemaIndicadoresPersona = esquemaConteoTareas.extend({
  usuario: esquemaPersona,
  area: z.string().nullable(),
});

export const esquemaIndicadoresArea = esquemaConteoTareas.extend({
  area: z.string(),
  personas: z.number().int().nonnegative(),
});

export const esquemaTablero = z.object({
  desde: z.iso.date(),
  hasta: z.iso.date(),
  equipo: esquemaConteoTareas.extend({ porRevisar: z.number().int().nonnegative() }),
  clientes: z.object({ activos: z.number().int().nonnegative(), nuevos: z.number().int().nonnegative() }).nullable(),
  trabajadoresActivos: z.number().int().nonnegative().nullable(),
  carga: z.array(esquemaIndicadoresPersona).nullable(),
  alertas: z.object({
    atrasadas: z.array(esquemaTareaResumen),
    urgentesSinIniciar: z.array(esquemaTareaResumen),
    porRevisar: z.array(esquemaTareaResumen),
  }),
});

export const esquemaAvanceHistorial = z.object({
  id: z.uuid(),
  registradoEn: z.iso.datetime(),
  tarea: z.object({ id: z.uuid(), codigo: z.string(), titulo: z.string() }),
  actividad: z.string(),
  porcentaje: z.number().int(),
  minutosDedicados: z.number().int().nonnegative(),
  evidencias: z.number().int().nonnegative(),
});

export const esquemaHistorialTrabajador = z.object({
  desde: z.iso.date(),
  hasta: z.iso.date(),
  usuario: esquemaPersona,
  cargo: z.string().nullable(),
  area: z.string().nullable(),
  indicadores: esquemaConteoTareas,
  avances: z.array(esquemaAvanceHistorial),
  tareas: z.array(esquemaTareaResumen),
});

export const esquemaReportePersonal = z.object({
  desde: z.iso.date(),
  hasta: z.iso.date(),
  area: z.string().nullable(),
  personas: z.array(esquemaIndicadoresPersona),
  areas: z.array(esquemaIndicadoresArea),
  total: esquemaConteoTareas,
});

export const esquemaFilaActividad = z.object({
  fecha: z.iso.date(),
  hora: z.string(),
  usuario: z.string(),
  area: z.string().nullable(),
  tareaCodigo: z.string(),
  tareaTitulo: z.string(),
  cliente: z.string().nullable(),
  actividad: z.string(),
  porcentaje: z.number().int(),
  minutos: z.number().int().nonnegative(),
});

export const esquemaReporteActividades = z.object({
  desde: z.iso.date(),
  hasta: z.iso.date(),
  area: z.string().nullable(),
  usuario: z.string().nullable(),
  filas: z.array(esquemaFilaActividad),
  totalMinutos: z.number().int().nonnegative(),
});

export type FiltroPeriodo = z.infer<typeof esquemaFiltroPeriodo>;
export type ConteoTareas = z.infer<typeof esquemaConteoTareas>;
export type IndicadoresPersona = z.infer<typeof esquemaIndicadoresPersona>;
export type IndicadoresArea = z.infer<typeof esquemaIndicadoresArea>;
export type Tablero = z.infer<typeof esquemaTablero>;
export type AvanceHistorial = z.infer<typeof esquemaAvanceHistorial>;
export type HistorialTrabajador = z.infer<typeof esquemaHistorialTrabajador>;
export type ReportePersonal = z.infer<typeof esquemaReportePersonal>;
export type FilaActividad = z.infer<typeof esquemaFilaActividad>;
export type ReporteActividades = z.infer<typeof esquemaReporteActividades>;
