import { z } from 'zod';
import { esquemaMetadatosPagina } from './common';
import { esquemaPeriodo } from './obligations';

export const CONFIDENCIALIDADES = ['NORMAL', 'RESTRINGIDO'] as const;

export const esquemaConfidencialidad = z.enum(CONFIDENCIALIDADES);

export type Confidencialidad = z.infer<typeof esquemaConfidencialidad>;

export const ETIQUETAS_CONFIDENCIALIDAD: Record<Confidencialidad, string> = {
  NORMAL: 'Normal: equipo del cliente',
  RESTRINGIDO: 'Restringido: solo Gerencia',
};

export const DIAS_ALERTA_DOCUMENTO = [30, 15, 7, 1] as const;

export const DIAS_ALERTA_DOCUMENTACION = [3, 1] as const;

export const TAMANO_MAXIMO_DOCUMENTO_MB = 25;

export const DOCUMENTOS_POR_PAGINA = 25;

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
  .pipe(z.iso.date('Ingrese una fecha válida.').nullable())
  .nullable();

const periodoOpcional = z
  .string()
  .trim()
  .transform((valor) => (valor === '' ? null : valor))
  .pipe(esquemaPeriodo.nullable())
  .nullable();

const idOpcional = z
  .string()
  .trim()
  .transform((valor) => (valor === '' ? null : valor))
  .pipe(z.uuid().nullable())
  .nullable();

export const esquemaTipoDocumentoEntrada = z.object({
  nombre: z.string().trim().min(3, 'Ingrese el nombre.').max(80),
  admiteVencimiento: z.boolean(),
});

export type TipoDocumentoEntrada = z.infer<typeof esquemaTipoDocumentoEntrada>;

export const esquemaTipoDocumento = z.object({
  id: z.uuid(),
  nombre: z.string(),
  admiteVencimiento: z.boolean(),
  activo: z.boolean(),
  documentos: z.number().int().nonnegative(),
});

export type TipoDocumento = z.infer<typeof esquemaTipoDocumento>;

export const esquemaCarpetaEntrada = z.object({
  nombre: z.string().trim().min(2, 'Ingrese el nombre de la carpeta.').max(80),
  padreId: idOpcional,
});

export type CarpetaEntrada = z.infer<typeof esquemaCarpetaEntrada>;

export const esquemaCarpeta = z.object({
  id: z.uuid(),
  nombre: z.string(),
  padreId: z.uuid().nullable(),
  ruta: z.string(),
  documentos: z.number().int().nonnegative(),
});

export type Carpeta = z.infer<typeof esquemaCarpeta>;

export const esquemaDocumentoEntrada = z
  .object({
    titulo: z.string().trim().min(3, 'Ingrese el título del documento.').max(200),
    tipoDocumentoId: z.uuid('Seleccione el tipo de documento.'),
    clienteId: idOpcional,
    carpetaId: idOpcional,
    areaId: idOpcional,
    periodo: periodoOpcional,
    fechaDocumento: fechaOpcional,
    fechaVencimiento: fechaOpcional,
    confidencialidad: esquemaConfidencialidad,
    nota: textoOpcional(500),
  })
  .superRefine((documento, contexto) => {
    if (documento.carpetaId !== null && documento.clienteId === null) {
      contexto.addIssue({ code: 'custom', path: ['carpetaId'], message: 'Las carpetas pertenecen a un cliente.' });
    }

    if (
      documento.fechaDocumento !== null &&
      documento.fechaVencimiento !== null &&
      documento.fechaVencimiento < documento.fechaDocumento
    ) {
      contexto.addIssue({
        code: 'custom',
        path: ['fechaVencimiento'],
        message: 'El vencimiento no puede ser anterior a la fecha del documento.',
      });
    }
  });

export type DocumentoEntrada = z.infer<typeof esquemaDocumentoEntrada>;

export const esquemaEdicionDocumento = z
  .object({
    titulo: z.string().trim().min(3, 'Ingrese el título del documento.').max(200),
    tipoDocumentoId: z.uuid('Seleccione el tipo de documento.'),
    carpetaId: idOpcional,
    areaId: idOpcional,
    periodo: periodoOpcional,
    fechaDocumento: fechaOpcional,
    fechaVencimiento: fechaOpcional,
    confidencialidad: esquemaConfidencialidad,
  })
  .superRefine((documento, contexto) => {
    if (
      documento.fechaDocumento !== null &&
      documento.fechaVencimiento !== null &&
      documento.fechaVencimiento < documento.fechaDocumento
    ) {
      contexto.addIssue({
        code: 'custom',
        path: ['fechaVencimiento'],
        message: 'El vencimiento no puede ser anterior a la fecha del documento.',
      });
    }
  });

export type EdicionDocumento = z.infer<typeof esquemaEdicionDocumento>;

export const esquemaVersionEntrada = z.object({ nota: textoOpcional(500) });

export type VersionEntrada = z.infer<typeof esquemaVersionEntrada>;

const esquemaPersona = z.object({ id: z.uuid(), nombre: z.string() });

export const esquemaDocumentoResumen = z.object({
  id: z.uuid(),
  titulo: z.string(),
  tipoDocumento: z.object({ id: z.uuid(), nombre: z.string() }),
  cliente: z.object({ id: z.uuid(), razonSocial: z.string() }).nullable(),
  carpeta: z.object({ id: z.uuid(), nombre: z.string() }).nullable(),
  periodo: z.string().nullable(),
  fechaDocumento: z.iso.date().nullable(),
  fechaVencimiento: z.iso.date().nullable(),
  vencido: z.boolean(),
  porVencer: z.boolean(),
  versionActual: z.number().int().positive(),
  confidencialidad: esquemaConfidencialidad,
  archivado: z.boolean(),
  archivo: z.object({ id: z.uuid(), nombre: z.string(), mime: z.string(), tamanoBytes: z.number().int() }),
  actualizadoEn: z.iso.datetime(),
});

export type DocumentoResumen = z.infer<typeof esquemaDocumentoResumen>;

export const esquemaVersionDocumento = z.object({
  id: z.uuid(),
  numero: z.number().int().positive(),
  nota: z.string().nullable(),
  cargadoPor: esquemaPersona,
  cargadoEn: z.iso.datetime(),
  archivo: z.object({ id: z.uuid(), nombre: z.string(), mime: z.string(), tamanoBytes: z.number().int() }),
});

export type VersionDocumento = z.infer<typeof esquemaVersionDocumento>;

export const esquemaDocumentoDetalle = esquemaDocumentoResumen.extend({
  area: z.object({ id: z.uuid(), nombre: z.string() }).nullable(),
  creadoPor: esquemaPersona,
  creadoEn: z.iso.datetime(),
  archivadoEn: z.iso.datetime().nullable(),
  motivoArchivo: z.string().nullable(),
  versiones: z.array(esquemaVersionDocumento),
  puedeGestionar: z.boolean(),
  puedeArchivar: z.boolean(),
});

export type DocumentoDetalle = z.infer<typeof esquemaDocumentoDetalle>;

const vacioAIndefinido = z
  .string()
  .trim()
  .transform((valor) => (valor === '' ? undefined : valor));

export const esquemaFiltroDocumentos = z
  .object({
    busqueda: vacioAIndefinido.pipe(z.string().max(100).optional()).optional(),
    clienteId: vacioAIndefinido.pipe(z.uuid().optional()).optional(),
    carpetaId: vacioAIndefinido.pipe(z.uuid().optional()).optional(),
    tipoDocumentoId: vacioAIndefinido.pipe(z.uuid().optional()).optional(),
    periodo: vacioAIndefinido.pipe(esquemaPeriodo.optional()).optional(),
    desde: vacioAIndefinido.pipe(z.iso.date().optional()).optional(),
    hasta: vacioAIndefinido.pipe(z.iso.date().optional()).optional(),
    vencimiento: vacioAIndefinido.pipe(z.enum(['por-vencer', 'vencidos']).optional()).optional(),
    archivados: vacioAIndefinido.pipe(z.enum(['si']).optional()).optional(),
    pagina: z.coerce.number().int().positive().default(1),
  })
  .superRefine((filtro, contexto) => {
    if (filtro.desde !== undefined && filtro.hasta !== undefined && filtro.desde > filtro.hasta) {
      contexto.addIssue({ code: 'custom', path: ['hasta'], message: 'La fecha final no puede ser anterior a la inicial.' });
    }
  });

export type FiltroDocumentos = z.infer<typeof esquemaFiltroDocumentos>;

export const esquemaPaginaDocumentos = esquemaMetadatosPagina.extend({
  elementos: z.array(esquemaDocumentoResumen),
});

export type PaginaDocumentos = z.infer<typeof esquemaPaginaDocumentos>;

export const esquemaOpcionesDocumentos = z.object({
  tipos: z.array(z.object({ id: z.uuid(), nombre: z.string(), admiteVencimiento: z.boolean() })),
  clientes: z.array(z.object({ id: z.uuid(), razonSocial: z.string() })),
  areas: z.array(z.object({ id: z.uuid(), nombre: z.string() })),
  puedeGestionar: z.boolean(),
  puedeRestringir: z.boolean(),
});

export type OpcionesDocumentos = z.infer<typeof esquemaOpcionesDocumentos>;

export const esquemaDocumentoEsperadoEntrada = z.object({
  tipoDocumentoId: z.uuid('Seleccione el tipo de documento.'),
  periodo: esquemaPeriodo,
  fechaLimite: z.iso.date('Ingrese la fecha límite.'),
  descripcion: textoOpcional(300),
});

export type DocumentoEsperadoEntrada = z.infer<typeof esquemaDocumentoEsperadoEntrada>;

export const ESTADOS_DOCUMENTO_ESPERADO = ['PENDIENTE', 'RECIBIDO', 'ANULADO'] as const;

export const esquemaEstadoDocumentoEsperado = z.enum(ESTADOS_DOCUMENTO_ESPERADO);

export type EstadoDocumentoEsperado = z.infer<typeof esquemaEstadoDocumentoEsperado>;

export const esquemaDocumentoEsperado = z.object({
  id: z.uuid(),
  tipoDocumento: z.object({ id: z.uuid(), nombre: z.string() }),
  periodo: z.string(),
  fechaLimite: z.iso.date(),
  descripcion: z.string().nullable(),
  estado: esquemaEstadoDocumentoEsperado,
  atrasado: z.boolean(),
  documento: z.object({ id: z.uuid(), titulo: z.string() }).nullable(),
});

export type DocumentoEsperado = z.infer<typeof esquemaDocumentoEsperado>;

export const esquemaArchivoDeTarea = z.object({
  archivo: z.object({ id: z.uuid(), nombre: z.string(), mime: z.string(), tamanoBytes: z.number().int() }),
  origen: z.enum(['EVIDENCIA', 'CONSTANCIA']),
  tarea: z.object({ id: z.uuid(), codigo: z.string(), titulo: z.string() }),
  subidoPor: z.string(),
  subidoEn: z.iso.datetime(),
});

export type ArchivoDeTarea = z.infer<typeof esquemaArchivoDeTarea>;

export const esquemaExpedienteDocumental = z.object({
  clienteId: z.uuid(),
  carpetas: z.array(esquemaCarpeta),
  esperados: z.array(esquemaDocumentoEsperado),
  archivosDeTareas: z.array(esquemaArchivoDeTarea),
  puedeGestionar: z.boolean(),
});

export type ExpedienteDocumental = z.infer<typeof esquemaExpedienteDocumental>;

export const esquemaIndicadoresDocumentales = z.object({
  porVencer: z.number().int().nonnegative(),
  vencidos: z.number().int().nonnegative(),
  documentacionAtrasada: z.number().int().nonnegative(),
});

export type IndicadoresDocumentales = z.infer<typeof esquemaIndicadoresDocumentales>;
