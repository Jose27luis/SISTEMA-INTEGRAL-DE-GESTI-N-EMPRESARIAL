import { z } from 'zod';

export const TAMANO_MAXIMO_SUBIDA_MB = 200;

export const TAMANO_PARTE_SUBIDA = 5 * 1024 * 1024;

export const MAXIMO_ARCHIVOS_POR_ENVIO = 10;

export const HORAS_VIGENCIA_SUBIDA = 24;

export const EXTENSIONES_SUBIDA = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'csv',
  'txt',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'zip',
] as const;

export const ACEPTAR_SUBIDA = EXTENSIONES_SUBIDA.map((extension) => `.${extension}`).join(',');

export function extensionDeNombre(nombre: string): string {
  const partes = nombre.toLowerCase().split('.');
  return partes.length > 1 ? (partes.at(-1) ?? '') : '';
}

export const esquemaSubidaEntrada = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'El archivo no tiene nombre.')
    .max(255, 'El nombre del archivo es demasiado largo.')
    .refine(
      (nombre) => (EXTENSIONES_SUBIDA as readonly string[]).includes(extensionDeNombre(nombre)),
      'Formato no admitido: use PDF, Word, Excel, PowerPoint, CSV, TXT, imágenes o ZIP.',
    ),
  tamanoBytes: z
    .number()
    .int()
    .positive('El archivo está vacío.')
    .max(TAMANO_MAXIMO_SUBIDA_MB * 1024 * 1024, `El archivo supera ${String(TAMANO_MAXIMO_SUBIDA_MB)} MB.`),
});
export type SubidaEntrada = z.infer<typeof esquemaSubidaEntrada>;

export const ESTADOS_SUBIDA = ['EN_CURSO', 'COMPLETA', 'USADA', 'EXPIRADA'] as const;
export const esquemaEstadoSubida = z.enum(ESTADOS_SUBIDA);

export const esquemaSubida = z.object({
  id: z.uuid(),
  estado: esquemaEstadoSubida,
  recibidos: z.number().int().nonnegative(),
  tamanoBytes: z.number().int().positive(),
  tamanoParte: z.number().int().positive(),
});
export type Subida = z.infer<typeof esquemaSubida>;

export const esquemaSubidaCompleta = z.object({
  id: z.uuid(),
  nombre: z.string(),
  mime: z.string(),
  tamanoBytes: z.number().int().positive(),
});
export type SubidaCompleta = z.infer<typeof esquemaSubidaCompleta>;

export const esquemaListaSubidas = z.preprocess(
  (valor: unknown): unknown[] => (valor === undefined || valor === '' ? [] : Array.isArray(valor) ? (valor as unknown[]) : [valor]),
  z.array(z.uuid()).max(MAXIMO_ARCHIVOS_POR_ENVIO, `Máximo ${String(MAXIMO_ARCHIVOS_POR_ENVIO)} archivos.`),
);

export const TIPOS_VISTA = ['pdf', 'imagen', 'documento', 'hoja', 'presentacion', 'texto', 'comprimido'] as const;
export const esquemaTipoVista = z.enum(TIPOS_VISTA);
export type TipoVista = z.infer<typeof esquemaTipoVista>;

export const ESTADOS_VISTA_PREVIA = ['PENDIENTE', 'PROCESANDO', 'LISTA', 'ERROR', 'NO_APLICA'] as const;
export const esquemaEstadoVistaPrevia = z.enum(ESTADOS_VISTA_PREVIA);
export type EstadoVistaPrevia = z.infer<typeof esquemaEstadoVistaPrevia>;

export const esquemaInfoArchivo = z.object({
  id: z.uuid(),
  nombre: z.string(),
  mime: z.string(),
  tamanoBytes: z.number().int().nonnegative(),
  tipo: esquemaTipoVista,
  vistaPdf: esquemaEstadoVistaPrevia,
  tabla: z.boolean(),
  subidoPor: z.string(),
  subidoEn: z.iso.datetime(),
});
export type InfoArchivo = z.infer<typeof esquemaInfoArchivo>;

export const MAXIMO_FILAS_TABLA = 500;
export const MAXIMO_COLUMNAS_TABLA = 40;

export const esquemaHojasArchivo = z.object({
  hojas: z.array(
    z.object({
      nombre: z.string(),
      filas: z.array(z.array(z.string())),
      totalFilas: z.number().int().nonnegative(),
      totalColumnas: z.number().int().nonnegative(),
      recortada: z.boolean(),
    }),
  ),
});
export type HojasArchivo = z.infer<typeof esquemaHojasArchivo>;

export function tipoVistaDe(nombre: string, mime: string): TipoVista {
  const extension = extensionDeNombre(nombre);

  if (mime === 'application/pdf') {
    return 'pdf';
  }

  if (mime.startsWith('image/')) {
    return 'imagen';
  }

  if (['xls', 'xlsx', 'csv'].includes(extension)) {
    return 'hoja';
  }

  if (['ppt', 'pptx'].includes(extension)) {
    return 'presentacion';
  }

  if (['doc', 'docx'].includes(extension)) {
    return 'documento';
  }

  return extension === 'zip' ? 'comprimido' : 'texto';
}
