import { z } from 'zod';
import { esquemaMetadatosPagina } from './common';
import { esquemaMonto } from './finance';
import { esquemaEstadoTarea } from './task-states';

export const PROYECTOS_POR_PAGINA = 25;

export const TAMANO_MAXIMO_ENTREGABLE_MB = 24;

export const MAXIMO_ETAPAS = 20;

export const ESTADOS_PROYECTO = ['PLANIFICADO', 'EN_CURSO', 'EN_PAUSA', 'FINALIZADO', 'CANCELADO'] as const;
export const esquemaEstadoProyecto = z.enum(ESTADOS_PROYECTO);
export type EstadoProyecto = z.infer<typeof esquemaEstadoProyecto>;
export const ETIQUETAS_ESTADO_PROYECTO: Record<EstadoProyecto, string> = {
  PLANIFICADO: 'Planificado',
  EN_CURSO: 'En curso',
  EN_PAUSA: 'En pausa',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
};
export const ESTADOS_PROYECTO_CERRADOS: readonly EstadoProyecto[] = ['FINALIZADO', 'CANCELADO'];

export const TRANSICIONES_PROYECTO: Record<EstadoProyecto, readonly EstadoProyecto[]> = {
  PLANIFICADO: ['EN_CURSO', 'CANCELADO'],
  EN_CURSO: ['EN_PAUSA', 'FINALIZADO', 'CANCELADO'],
  EN_PAUSA: ['EN_CURSO', 'CANCELADO'],
  FINALIZADO: [],
  CANCELADO: [],
};

export const ESTADOS_ETAPA = ['PENDIENTE', 'EN_CURSO', 'COMPLETADA'] as const;
export const esquemaEstadoEtapa = z.enum(ESTADOS_ETAPA);
export type EstadoEtapa = z.infer<typeof esquemaEstadoEtapa>;
export const ETIQUETAS_ESTADO_ETAPA: Record<EstadoEtapa, string> = {
  PENDIENTE: 'Pendiente',
  EN_CURSO: 'En curso',
  COMPLETADA: 'Completada',
};

export const ESTADOS_ENTREGABLE = ['PENDIENTE', 'ENTREGADO', 'OBSERVADO', 'APROBADO'] as const;
export const esquemaEstadoEntregable = z.enum(ESTADOS_ENTREGABLE);
export type EstadoEntregable = z.infer<typeof esquemaEstadoEntregable>;
export const ETIQUETAS_ESTADO_ENTREGABLE: Record<EstadoEntregable, string> = {
  PENDIENTE: 'Pendiente',
  ENTREGADO: 'Por aprobar',
  OBSERVADO: 'Observado',
  APROBADO: 'Aprobado',
};

const textoOpcional = (maximo: number) =>
  z
    .string()
    .trim()
    .max(maximo, `Máximo ${String(maximo)} caracteres.`)
    .transform((valor) => (valor === '' ? null : valor))
    .nullable();

const idOpcional = z
  .string()
  .trim()
  .transform((valor) => (valor === '' ? null : valor))
  .pipe(z.uuid().nullable())
  .nullable();

const montoOpcional = z
  .union([z.literal(''), z.null(), esquemaMonto])
  .transform((valor) => (valor === '' ? null : valor));

export const esquemaProyectoEntrada = z
  .object({
    nombre: z.string().trim().min(3, 'Escriba el nombre del proyecto.').max(200),
    clienteId: idOpcional,
    servicioId: idOpcional,
    descripcion: textoOpcional(5000),
    objetivo: textoOpcional(2000),
    responsableId: z.uuid('Seleccione el responsable.'),
    miembroIds: z.array(z.uuid()).max(30, 'Máximo 30 integrantes.'),
    presupuesto: montoOpcional,
    honorarios: montoOpcional,
    fechaInicio: z.iso.date('Ingrese la fecha de inicio.'),
    fechaEntrega: z.iso.date('Ingrese la fecha de entrega.'),
  })
  .superRefine((proyecto, contexto) => {
    if (proyecto.fechaEntrega < proyecto.fechaInicio) {
      contexto.addIssue({ code: 'custom', path: ['fechaEntrega'], message: 'La entrega no puede ser anterior al inicio.' });
    }
  });
export type ProyectoEntrada = z.infer<typeof esquemaProyectoEntrada>;

export const esquemaCambioEstadoProyecto = z
  .object({
    estado: esquemaEstadoProyecto,
    comentario: textoOpcional(2000),
  })
  .superRefine((cambio, contexto) => {
    if ((cambio.estado === 'FINALIZADO' || cambio.estado === 'CANCELADO') && (cambio.comentario ?? '').length < 5) {
      contexto.addIssue({
        code: 'custom',
        path: ['comentario'],
        message: cambio.estado === 'FINALIZADO' ? 'Describa el resultado final.' : 'Indique el motivo de la cancelación.',
      });
    }
  });
export type CambioEstadoProyecto = z.infer<typeof esquemaCambioEstadoProyecto>;

export const esquemaDificultadEntrada = z
  .object({
    conDificultades: z.boolean(),
    detalle: textoOpcional(1000),
  })
  .superRefine((dificultad, contexto) => {
    if (dificultad.conDificultades && (dificultad.detalle ?? '').length < 5) {
      contexto.addIssue({ code: 'custom', path: ['detalle'], message: 'Describa la dificultad.' });
    }
  });
export type DificultadEntrada = z.infer<typeof esquemaDificultadEntrada>;

export const esquemaEtapaEntrada = z
  .object({
    nombre: z.string().trim().min(2, 'Escriba el nombre de la etapa.').max(120),
    inicio: z.iso.date('Ingrese el inicio.'),
    fin: z.iso.date('Ingrese el fin.'),
    estado: esquemaEstadoEtapa.default('PENDIENTE'),
  })
  .superRefine((etapa, contexto) => {
    if (etapa.fin < etapa.inicio) {
      contexto.addIssue({ code: 'custom', path: ['fin'], message: 'El fin no puede ser anterior al inicio.' });
    }
  });
export type EtapaEntrada = z.infer<typeof esquemaEtapaEntrada>;

export const esquemaOrdenEtapa = z.object({ direccion: z.enum(['subir', 'bajar']) });
export type OrdenEtapa = z.infer<typeof esquemaOrdenEtapa>;

export const esquemaEntregableEntrada = z.object({
  nombre: z.string().trim().min(2, 'Escriba el nombre del entregable.').max(200),
  fechaCompromiso: z.iso.date('Ingrese la fecha de compromiso.'),
});
export type EntregableEntrada = z.infer<typeof esquemaEntregableEntrada>;

export const esquemaRevisionEntregable = z
  .object({
    decision: z.enum(['APROBAR', 'OBSERVAR']),
    comentario: textoOpcional(1000),
  })
  .superRefine((revision, contexto) => {
    if (revision.decision === 'OBSERVAR' && (revision.comentario ?? '').length < 5) {
      contexto.addIssue({ code: 'custom', path: ['comentario'], message: 'Explique qué se debe corregir.' });
    }
  });
export type RevisionEntregable = z.infer<typeof esquemaRevisionEntregable>;

const esquemaPersona = z.object({ id: z.uuid(), nombre: z.string() });

export const esquemaProyectoResumen = z.object({
  id: z.uuid(),
  codigo: z.string(),
  nombre: z.string(),
  cliente: z.object({ id: z.uuid(), razonSocial: z.string() }).nullable(),
  responsable: esquemaPersona,
  estado: esquemaEstadoProyecto,
  fechaInicio: z.iso.date(),
  fechaEntrega: z.iso.date(),
  avance: z.number().int().min(0).max(100),
  tareas: z.number().int().nonnegative(),
  conDificultades: z.boolean(),
  detalleDificultad: z.string().nullable(),
  atrasado: z.boolean(),
});
export type ProyectoResumen = z.infer<typeof esquemaProyectoResumen>;

export const esquemaTareaProyecto = z.object({
  id: z.uuid(),
  codigo: z.string(),
  titulo: z.string(),
  estado: esquemaEstadoTarea,
  responsable: esquemaPersona,
  fechaInicio: z.iso.date().nullable(),
  fechaLimite: z.iso.date(),
  porcentajeAvance: z.number().int().min(0).max(100),
  atrasada: z.boolean(),
  etapaId: z.uuid(),
});
export type TareaProyecto = z.infer<typeof esquemaTareaProyecto>;

export const esquemaEntregable = z.object({
  id: z.uuid(),
  nombre: z.string(),
  fechaCompromiso: z.iso.date(),
  estado: esquemaEstadoEntregable,
  archivo: z.object({ id: z.uuid(), nombre: z.string() }).nullable(),
  entregadoPor: z.string().nullable(),
  entregadoEn: z.iso.datetime().nullable(),
  revisadoPor: z.string().nullable(),
  revisadoEn: z.iso.datetime().nullable(),
  comentario: z.string().nullable(),
  vencido: z.boolean(),
});
export type Entregable = z.infer<typeof esquemaEntregable>;

export const esquemaEtapa = z.object({
  id: z.uuid(),
  nombre: z.string(),
  orden: z.number().int(),
  inicio: z.iso.date(),
  fin: z.iso.date(),
  estado: esquemaEstadoEtapa,
  avance: z.number().int().min(0).max(100),
  entregables: z.array(esquemaEntregable),
});
export type Etapa = z.infer<typeof esquemaEtapa>;

export const esquemaProyectoDetalle = esquemaProyectoResumen.extend({
  servicio: z.object({ id: z.uuid(), nombre: z.string() }).nullable(),
  descripcion: z.string().nullable(),
  objetivo: z.string().nullable(),
  presupuesto: z.number().nullable(),
  honorarios: z.number().nullable(),
  egresos: z.number(),
  resultadoFinal: z.string().nullable(),
  miembros: z.array(esquemaPersona),
  etapas: z.array(esquemaEtapa),
  tareasDetalle: z.array(esquemaTareaProyecto),
  creadoPor: z.string(),
  creadoEn: z.iso.datetime(),
  permisos: z.object({
    editar: z.boolean(),
    crearTareas: z.boolean(),
    entregar: z.boolean(),
    aprobar: z.boolean(),
    transiciones: z.array(esquemaEstadoProyecto),
  }),
});
export type ProyectoDetalle = z.infer<typeof esquemaProyectoDetalle>;

const vacioAIndefinido = z
  .string()
  .trim()
  .transform((valor) => (valor === '' ? undefined : valor));

export const esquemaFiltroProyectos = z.object({
  busqueda: vacioAIndefinido.pipe(z.string().max(100).optional()).optional(),
  clienteId: vacioAIndefinido.pipe(z.uuid().optional()).optional(),
  responsableId: vacioAIndefinido.pipe(z.uuid().optional()).optional(),
  estado: vacioAIndefinido.pipe(esquemaEstadoProyecto.optional()).optional(),
  dificultades: vacioAIndefinido.pipe(z.enum(['si']).optional()).optional(),
  pagina: z.coerce.number().int().positive().default(1),
});
export type FiltroProyectos = z.infer<typeof esquemaFiltroProyectos>;

export const esquemaPaginaProyectos = esquemaMetadatosPagina.extend({
  elementos: z.array(esquemaProyectoResumen),
});
export type PaginaProyectos = z.infer<typeof esquemaPaginaProyectos>;

export const esquemaOpcionesProyecto = z.object({
  clientes: z.array(z.object({ id: z.uuid(), nombre: z.string() })),
  servicios: z.array(z.object({ id: z.uuid(), nombre: z.string() })),
  usuarios: z.array(esquemaPersona),
  puedeCrear: z.boolean(),
});
export type OpcionesProyecto = z.infer<typeof esquemaOpcionesProyecto>;

export const esquemaIndicadoresProyectos = z.object({
  activos: z.number().int().nonnegative(),
  finalizadosDelAnio: z.number().int().nonnegative(),
  atrasados: z.number().int().nonnegative(),
  conDificultades: z.array(esquemaProyectoResumen),
});
export type IndicadoresProyectos = z.infer<typeof esquemaIndicadoresProyectos>;
