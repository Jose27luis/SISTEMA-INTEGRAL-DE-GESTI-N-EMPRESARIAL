import { z } from 'zod';
import { esquemaReferenciaCatalogo } from './catalogs';
import { esquemaMetadatosPagina } from './common';
import { esquemaEstadoTarea } from './task-states';

export const PRIORIDADES = ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'] as const;

export const esquemaPrioridad = z.enum(PRIORIDADES);

export type Prioridad = z.infer<typeof esquemaPrioridad>;

export const ETIQUETAS_PRIORIDAD: Record<Prioridad, string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
  URGENTE: 'Urgente',
};

export const MAXIMO_EVIDENCIAS_POR_AVANCE = 10;
export const TAMANO_MAXIMO_EVIDENCIA_MB = 24;

const esquemaOpcion = z.object({ id: z.uuid(), nombre: z.string() });

export const esquemaOpcionesTarea = z.object({
  usuarios: z.array(esquemaOpcion),
  clientes: z.array(esquemaOpcion),
});

export type OpcionesTarea = z.infer<typeof esquemaOpcionesTarea>;

const textoOpcional = (maximo: number) =>
  z
    .string()
    .trim()
    .max(maximo, `Máximo ${String(maximo)} caracteres.`)
    .transform((valor) => (valor === '' ? null : valor))
    .nullable();

const fechaOpcional = z
  .string()
  .trim()
  .transform((valor) => (valor === '' ? null : valor))
  .pipe(z.iso.date('Fecha no válida.').nullable())
  .nullable();

const esquemaBaseTarea = z.object({
  titulo: z.string().trim().min(3, 'Escriba un título de al menos 3 caracteres.').max(200),
  instrucciones: textoOpcional(5000),
  clienteId: z.uuid().nullable(),
  responsableId: z.uuid('Seleccione el responsable.'),
  colaboradorIds: z.array(z.uuid()).max(20, 'Máximo 20 colaboradores.'),
  revisorId: z.uuid().nullable(),
  prioridad: esquemaPrioridad,
  fechaInicio: fechaOpcional,
  fechaLimite: z.iso.date('Ingrese la fecha límite.'),
  requiereAprobacion: z.boolean(),
  requiereEvidencia: z.boolean(),
  evidenciaRequerida: textoOpcional(1000),
});

type BaseTarea = z.infer<typeof esquemaBaseTarea>;

function validarReglasTarea(tarea: BaseTarea, contexto: z.RefinementCtx): void {
  if (tarea.requiereAprobacion && tarea.revisorId === null) {
    contexto.addIssue({ code: 'custom', path: ['revisorId'], message: 'Seleccione quién revisará el trabajo.' });
  }

  if (tarea.revisorId !== null && tarea.revisorId === tarea.responsableId) {
    contexto.addIssue({
      code: 'custom',
      path: ['revisorId'],
      message: 'El revisor debe ser distinto del responsable.',
    });
  }

  if (tarea.fechaInicio !== null && tarea.fechaInicio > tarea.fechaLimite) {
    contexto.addIssue({
      code: 'custom',
      path: ['fechaLimite'],
      message: 'La fecha límite no puede ser anterior a la de inicio.',
    });
  }

  if (tarea.requiereEvidencia && tarea.evidenciaRequerida === null) {
    contexto.addIssue({
      code: 'custom',
      path: ['evidenciaRequerida'],
      message: 'Describa qué evidencia debe adjuntarse.',
    });
  }
}

export const esquemaTareaEntrada = esquemaBaseTarea.superRefine(validarReglasTarea);

export const esquemaEdicionTarea = esquemaBaseTarea
  .extend({ version: z.coerce.number().int().positive() })
  .superRefine(validarReglasTarea);

const esquemaPersona = z.object({ id: z.uuid(), nombre: z.string() });

export const esquemaTareaResumen = z.object({
  id: z.uuid(),
  codigo: z.string(),
  titulo: z.string(),
  estado: esquemaEstadoTarea,
  prioridad: esquemaPrioridad,
  fechaInicio: z.iso.date().nullable(),
  fechaLimite: z.iso.date(),
  cliente: esquemaReferenciaCatalogo.nullable(),
  responsable: esquemaPersona,
  porcentajeAvance: z.number().int().min(0).max(100),
  atrasada: z.boolean(),
});

export const esquemaEvidencia = z.object({
  id: z.uuid(),
  nombre: z.string(),
  mime: z.string(),
  tamanoBytes: z.number().int().nonnegative(),
});

export const esquemaAvance = z.object({
  id: z.uuid(),
  registradoEn: z.iso.datetime(),
  autor: esquemaPersona,
  actividad: z.string(),
  descripcion: z.string(),
  porcentaje: z.number().int().min(0).max(100),
  minutosDedicados: z.number().int().nonnegative(),
  dificultades: z.string().nullable(),
  observaciones: z.string().nullable(),
  proximoPaso: z.string().nullable(),
  corrigeAId: z.uuid().nullable(),
  evidencias: z.array(esquemaEvidencia),
});

export const esquemaComentario = z.object({
  id: z.uuid(),
  autor: esquemaPersona,
  contenido: z.string(),
  creadoEn: z.iso.datetime(),
  mencionados: z.array(esquemaPersona),
});

export const esquemaTransicion = z.object({
  id: z.uuid(),
  desde: esquemaEstadoTarea.nullable(),
  hacia: esquemaEstadoTarea,
  usuario: z.string(),
  comentario: z.string().nullable(),
  fecha: z.iso.datetime(),
});

export const esquemaTareaDetalle = esquemaTareaResumen.extend({
  instrucciones: z.string().nullable(),
  revisor: esquemaPersona.nullable(),
  asignadoPor: esquemaPersona,
  colaboradores: z.array(esquemaPersona),
  requiereAprobacion: z.boolean(),
  requiereEvidencia: z.boolean(),
  evidenciaRequerida: z.string().nullable(),
  minutosRegistrados: z.number().int().nonnegative(),
  version: z.number().int().positive(),
  creadoEn: z.iso.datetime(),
  avances: z.array(esquemaAvance),
  comentarios: z.array(esquemaComentario),
  transiciones: z.array(esquemaTransicion),
  participantes: z.array(esquemaPersona),
  acciones: z.object({
    editar: z.boolean(),
    iniciar: z.boolean(),
    registrarAvance: z.boolean(),
    comentar: z.boolean(),
  }),
});

export const esquemaAvanceEntrada = z.object({
  actividad: z.string().trim().min(3, 'Indique la actividad realizada.').max(200),
  descripcion: z.string().trim().min(3, 'Describa el trabajo realizado.').max(5000),
  porcentaje: z.coerce.number().int('Use un número entero.').min(0).max(100, 'Máximo 100 %.'),
  minutosDedicados: z.coerce.number().int('Use minutos enteros.').min(0).max(1440, 'Máximo 1440 minutos.'),
  dificultades: textoOpcional(2000),
  observaciones: textoOpcional(2000),
  proximoPaso: textoOpcional(1000),
  corrigeAId: z
    .string()
    .trim()
    .transform((valor) => (valor === '' ? null : valor))
    .pipe(z.uuid().nullable())
    .nullable(),
});

export const esquemaComentarioEntrada = z.object({
  contenido: z.string().trim().min(1, 'Escriba el comentario.').max(2000),
  mencionadoIds: z.array(z.uuid()).max(20),
});

const vacioAIndefinido = z
  .string()
  .trim()
  .transform((valor) => (valor === '' ? undefined : valor));

export const FILTROS_ESTADO_TAREA = ['ABIERTAS', 'CERRADAS'] as const;

export const esquemaFiltroTareas = z.object({
  busqueda: vacioAIndefinido.pipe(z.string().max(100).optional()).optional(),
  estado: vacioAIndefinido
    .pipe(z.union([esquemaEstadoTarea, z.enum(FILTROS_ESTADO_TAREA)]).optional())
    .optional(),
  responsableId: vacioAIndefinido.pipe(z.uuid().optional()).optional(),
  clienteId: vacioAIndefinido.pipe(z.uuid().optional()).optional(),
  prioridad: vacioAIndefinido.pipe(esquemaPrioridad.optional()).optional(),
  atrasadas: vacioAIndefinido.pipe(z.literal('si').optional()).optional(),
  desde: vacioAIndefinido.pipe(z.iso.date().optional()).optional(),
  hasta: vacioAIndefinido.pipe(z.iso.date().optional()).optional(),
  pagina: z.coerce.number().int().positive().max(100000).default(1),
  porPagina: z.coerce.number().int().min(10).max(500).default(25),
});

export const esquemaPaginaTareas = esquemaMetadatosPagina.extend({
  elementos: z.array(esquemaTareaResumen),
});

export const esquemaMiTrabajo = z.object({
  atrasadas: z.array(esquemaTareaResumen),
  hoy: z.array(esquemaTareaResumen),
  proximas: z.array(esquemaTareaResumen),
  posteriores: z.array(esquemaTareaResumen),
  porRevisar: z.number().int().nonnegative(),
});

export type TareaEntrada = z.infer<typeof esquemaTareaEntrada>;
export type EdicionTarea = z.infer<typeof esquemaEdicionTarea>;
export type TareaResumen = z.infer<typeof esquemaTareaResumen>;
export type Evidencia = z.infer<typeof esquemaEvidencia>;
export type Avance = z.infer<typeof esquemaAvance>;
export type Comentario = z.infer<typeof esquemaComentario>;
export type Transicion = z.infer<typeof esquemaTransicion>;
export type TareaDetalle = z.infer<typeof esquemaTareaDetalle>;
export type AvanceEntrada = z.infer<typeof esquemaAvanceEntrada>;
export type ComentarioEntrada = z.infer<typeof esquemaComentarioEntrada>;
export type FiltroTareas = z.infer<typeof esquemaFiltroTareas>;
export type PaginaTareas = z.infer<typeof esquemaPaginaTareas>;
export type MiTrabajo = z.infer<typeof esquemaMiTrabajo>;
