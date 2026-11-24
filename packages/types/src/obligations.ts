import { z } from 'zod';
import { esquemaEstadoTarea } from './task-states';

export const PATRON_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/u;

export const esquemaPeriodo = z.string().trim().regex(PATRON_PERIODO, 'Use el formato AAAA-MM.');

export type Periodo = z.infer<typeof esquemaPeriodo>;

export const GRUPOS_CRONOGRAMA = ['GENERAL', 'BUENOS_CONTRIBUYENTES'] as const;

export const esquemaGrupoCronograma = z.enum(GRUPOS_CRONOGRAMA);

export type GrupoCronograma = z.infer<typeof esquemaGrupoCronograma>;

export const ETIQUETAS_GRUPO_CRONOGRAMA: Record<GrupoCronograma, string> = {
  GENERAL: 'General',
  BUENOS_CONTRIBUYENTES: 'Buenos contribuyentes y UESP',
};

export const ESTADOS_OBLIGACION = [
  'PENDIENTE',
  'EN_PROCESO',
  'PRESENTADA',
  'OBSERVADA',
  'CUMPLIDA',
  'ANULADA',
] as const;

export const esquemaEstadoObligacion = z.enum(ESTADOS_OBLIGACION);

export type EstadoObligacion = z.infer<typeof esquemaEstadoObligacion>;

export const ETIQUETAS_ESTADO_OBLIGACION: Record<EstadoObligacion, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  PRESENTADA: 'Presentada',
  OBSERVADA: 'Observada',
  CUMPLIDA: 'Cumplida',
  ANULADA: 'Anulada',
};

export const DIAS_ALERTA_PREDETERMINADOS = [5, 3, 1] as const;

export const TAMANO_MAXIMO_CONSTANCIA_MB = 25;

export const MAXIMO_PERIODOS_GENERACION = 1;

const textoOpcional = (maximo: number) =>
  z
    .string()
    .trim()
    .max(maximo, `Máximo ${String(maximo)} caracteres.`)
    .transform((valor) => (valor === '' ? null : valor))
    .nullable();

export const esquemaDiasAlerta = z
  .array(z.number().int().min(1, 'Mínimo 1 día.').max(30, 'Máximo 30 días.'))
  .max(5, 'Configure como máximo 5 avisos.')
  .transform((dias) => [...new Set(dias)].sort((a, b) => b - a));

export const esquemaTipoObligacionEntrada = z
  .object({
    codigo: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{2,20}$/u, 'Use de 2 a 20 letras, números, guiones o guiones bajos.'),
    nombre: z.string().trim().min(3, 'Ingrese el nombre.').max(120),
    descripcion: textoOpcional(500),
    usaCronograma: z.boolean(),
    diaVencimiento: z.number().int().min(1, 'Entre 1 y 28.').max(28, 'Entre 1 y 28.').nullable(),
    diasAlerta: esquemaDiasAlerta,
  })
  .superRefine((tipo, contexto) => {
    if (!tipo.usaCronograma && tipo.diaVencimiento === null) {
      contexto.addIssue({
        code: 'custom',
        path: ['diaVencimiento'],
        message: 'Indique el día de vencimiento del mes siguiente al periodo.',
      });
    }
  });

export type TipoObligacionEntrada = z.infer<typeof esquemaTipoObligacionEntrada>;

export const esquemaTipoObligacion = z.object({
  id: z.uuid(),
  codigo: z.string(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  usaCronograma: z.boolean(),
  diaVencimiento: z.number().int().nullable(),
  diasAlerta: z.array(z.number().int()),
  activo: z.boolean(),
  clientesConfigurados: z.number().int().nonnegative(),
});

export type TipoObligacion = z.infer<typeof esquemaTipoObligacion>;

export const DIGITOS_RUC = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export const esquemaCronogramaEntrada = z.object({
  tipoObligacionId: z.uuid(),
  periodo: esquemaPeriodo,
  grupo: esquemaGrupoCronograma,
  fuente: z.string().trim().min(5, 'Indique la resolución o el enlace oficial.').max(300),
  fechas: z
    .array(z.object({ ultimoDigito: z.number().int().min(0).max(9), fechaVencimiento: z.iso.date('Ingrese la fecha.') }))
    .length(10, 'Ingrese la fecha de los 10 dígitos.')
    .superRefine((fechas, contexto) => {
      const digitos = new Set(fechas.map(({ ultimoDigito }) => ultimoDigito));

      if (digitos.size !== 10) {
        contexto.addIssue({ code: 'custom', message: 'Cada dígito del 0 al 9 debe tener una sola fecha.' });
      }
    }),
});

export type CronogramaEntrada = z.infer<typeof esquemaCronogramaEntrada>;

export const esquemaFiltroCronograma = z.object({
  anio: z.coerce.number().int().min(2020).max(2100),
});

export type FiltroCronograma = z.infer<typeof esquemaFiltroCronograma>;

export const esquemaCronogramaPeriodo = z.object({
  tipoObligacion: z.object({ id: z.uuid(), codigo: z.string(), nombre: z.string() }),
  periodo: z.string(),
  grupo: esquemaGrupoCronograma,
  fuente: z.string(),
  fechas: z.array(z.object({ ultimoDigito: z.number().int(), fechaVencimiento: z.iso.date() })),
  cargadoPor: z.string(),
  actualizadoEn: z.iso.datetime(),
});

export type CronogramaPeriodo = z.infer<typeof esquemaCronogramaPeriodo>;

export const esquemaListaCronograma = z.object({
  anio: z.number().int(),
  cronogramas: z.array(esquemaCronogramaPeriodo),
});

export type ListaCronograma = z.infer<typeof esquemaListaCronograma>;

const esquemaPersona = z.object({ id: z.uuid(), nombre: z.string() });

export const esquemaObligacionClienteEntrada = z
  .object({
    tipoObligacionId: z.uuid('Seleccione el tipo de obligación.'),
    responsableId: z.uuid('Seleccione al responsable.'),
    revisorId: z.uuid().nullable(),
    desdePeriodo: esquemaPeriodo,
    hastaPeriodo: esquemaPeriodo.nullable(),
  })
  .superRefine((entrada, contexto) => {
    if (entrada.revisorId !== null && entrada.revisorId === entrada.responsableId) {
      contexto.addIssue({ code: 'custom', path: ['revisorId'], message: 'El revisor debe ser distinto del responsable.' });
    }

    if (entrada.hastaPeriodo !== null && entrada.hastaPeriodo < entrada.desdePeriodo) {
      contexto.addIssue({
        code: 'custom',
        path: ['hastaPeriodo'],
        message: 'El periodo final no puede ser anterior al inicial.',
      });
    }
  });

export type ObligacionClienteEntrada = z.infer<typeof esquemaObligacionClienteEntrada>;

export const esquemaGrupoClienteEntrada = z.object({ grupoCronograma: esquemaGrupoCronograma });

export type GrupoClienteEntrada = z.infer<typeof esquemaGrupoClienteEntrada>;

export const esquemaObligacionCliente = z.object({
  id: z.uuid(),
  tipoObligacion: z.object({ id: z.uuid(), codigo: z.string(), nombre: z.string(), usaCronograma: z.boolean() }),
  responsable: esquemaPersona,
  revisor: esquemaPersona.nullable(),
  desdePeriodo: z.string(),
  hastaPeriodo: z.string().nullable(),
  activo: z.boolean(),
});

export type ObligacionCliente = z.infer<typeof esquemaObligacionCliente>;

export const esquemaFichaTributaria = z.object({
  clienteId: z.uuid(),
  ruc: z.string().nullable(),
  grupoCronograma: esquemaGrupoCronograma,
  puedeGestionar: z.boolean(),
  obligaciones: z.array(esquemaObligacionCliente),
});

export type FichaTributaria = z.infer<typeof esquemaFichaTributaria>;

export const esquemaObligacionResumen = z.object({
  id: z.uuid(),
  periodo: z.string(),
  fechaVencimiento: z.iso.date(),
  estado: esquemaEstadoObligacion,
  vencida: z.boolean(),
  cliente: z.object({ id: z.uuid(), razonSocial: z.string(), ruc: z.string().nullable() }),
  tipoObligacion: z.object({ id: z.uuid(), codigo: z.string(), nombre: z.string() }),
  responsable: esquemaPersona,
  revisor: esquemaPersona.nullable(),
  tareaId: z.uuid(),
  fechaPresentacion: z.iso.date().nullable(),
});

export type ObligacionResumen = z.infer<typeof esquemaObligacionResumen>;

const vacioAIndefinido = z
  .string()
  .trim()
  .transform((valor) => (valor === '' ? undefined : valor));

export const esquemaFiltroObligaciones = z.object({
  mes: vacioAIndefinido.pipe(esquemaPeriodo.optional()).optional(),
  clienteId: vacioAIndefinido.pipe(z.uuid().optional()).optional(),
  responsableId: vacioAIndefinido.pipe(z.uuid().optional()).optional(),
  tipoObligacionId: vacioAIndefinido.pipe(z.uuid().optional()).optional(),
  estado: vacioAIndefinido.pipe(esquemaEstadoObligacion.optional()).optional(),
});

export type FiltroObligaciones = z.infer<typeof esquemaFiltroObligaciones>;

export const esquemaListaObligaciones = z.object({
  mes: z.string(),
  obligaciones: z.array(esquemaObligacionResumen),
});

export type ListaObligaciones = z.infer<typeof esquemaListaObligaciones>;

export const esquemaOpcionesObligaciones = z.object({
  clientes: z.array(z.object({ id: z.uuid(), razonSocial: z.string() })),
  responsables: z.array(esquemaPersona),
  tipos: z.array(z.object({ id: z.uuid(), codigo: z.string(), nombre: z.string(), usaCronograma: z.boolean() })),
});

export type OpcionesObligaciones = z.infer<typeof esquemaOpcionesObligaciones>;

export const esquemaCeldaControl = z.object({
  obligacionId: z.uuid(),
  estado: esquemaEstadoObligacion,
  vencida: z.boolean(),
  fechaVencimiento: z.iso.date(),
});

export const esquemaControlMensual = z.object({
  periodo: z.string(),
  tipos: z.array(z.object({ id: z.uuid(), codigo: z.string(), nombre: z.string() })),
  filas: z.array(
    z.object({
      cliente: z.object({ id: z.uuid(), razonSocial: z.string(), ruc: z.string().nullable() }),
      celdas: z.record(z.string(), esquemaCeldaControl.nullable()),
      configuradas: z.array(z.uuid()),
    }),
  ),
  totales: z.record(esquemaEstadoObligacion, z.number().int().nonnegative()),
  vencidas: z.number().int().nonnegative(),
  sinGenerar: z.number().int().nonnegative(),
  puedeGenerar: z.boolean(),
});

export type ControlMensual = z.infer<typeof esquemaControlMensual>;

export const esquemaGeneracionEntrada = z.object({ periodo: esquemaPeriodo });

export type GeneracionEntrada = z.infer<typeof esquemaGeneracionEntrada>;

export const MOTIVOS_OMISION = ['SIN_CRONOGRAMA', 'SIN_RUC', 'RESPONSABLE_NO_ASIGNADO', 'REVISOR_NO_ASIGNADO'] as const;

export const esquemaMotivoOmision = z.enum(MOTIVOS_OMISION);

export type MotivoOmision = z.infer<typeof esquemaMotivoOmision>;

export const ETIQUETAS_MOTIVO_OMISION: Record<MotivoOmision, string> = {
  SIN_CRONOGRAMA: 'Falta cargar el cronograma',
  SIN_RUC: 'El cliente no tiene RUC',
  RESPONSABLE_NO_ASIGNADO: 'El responsable ya no está asignado al cliente o está inactivo',
  REVISOR_NO_ASIGNADO: 'El revisor ya no está asignado al cliente o está inactivo',
};

export const esquemaResultadoGeneracion = z.object({
  periodo: z.string(),
  generadas: z.number().int().nonnegative(),
  existentes: z.number().int().nonnegative(),
  omitidas: z.array(
    z.object({
      cliente: z.string(),
      tipoObligacion: z.string(),
      motivo: esquemaMotivoOmision,
      detalle: z.string().nullable(),
    }),
  ),
});

export type ResultadoGeneracion = z.infer<typeof esquemaResultadoGeneracion>;

export const esquemaPresentacionEntrada = z.object({
  fechaPresentacion: z.iso.date('Ingrese la fecha de presentación.'),
  numeroOrden: textoOpcional(40),
  observaciones: textoOpcional(1000),
});

export type PresentacionEntrada = z.infer<typeof esquemaPresentacionEntrada>;

export const esquemaObligacionDetalle = esquemaObligacionResumen.extend({
  grupoCronograma: esquemaGrupoCronograma,
  usaCronograma: z.boolean(),
  numeroOrden: z.string().nullable(),
  observaciones: z.string().nullable(),
  constancia: z.object({ id: z.uuid(), nombre: z.string(), tamanoBytes: z.number().int() }).nullable(),
  estadoTarea: esquemaEstadoTarea,
  aprobacion: z.object({ revisor: z.string(), fecha: z.iso.datetime() }).nullable(),
  generadaEn: z.iso.datetime(),
  puedePresentar: z.boolean(),
});

export type ObligacionDetalle = z.infer<typeof esquemaObligacionDetalle>;

export const esquemaIndicadoresTributarios = z.object({
  porVencer: z.number().int().nonnegative(),
  vencidas: z.number().int().nonnegative(),
  presentadasDelMes: z.number().int().nonnegative(),
  cumplidasDelMes: z.number().int().nonnegative(),
  proximas: z.array(esquemaObligacionResumen),
});

export type IndicadoresTributarios = z.infer<typeof esquemaIndicadoresTributarios>;
