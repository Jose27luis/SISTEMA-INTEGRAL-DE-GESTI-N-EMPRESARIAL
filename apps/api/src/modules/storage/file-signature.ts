export interface TipoArchivo {
  mime: string;
  extension: string;
  vistaPrevia: boolean;
}

const PDF: TipoArchivo = { mime: 'application/pdf', extension: 'pdf', vistaPrevia: true };
const PNG: TipoArchivo = { mime: 'image/png', extension: 'png', vistaPrevia: true };
const JPEG: TipoArchivo = { mime: 'image/jpeg', extension: 'jpg', vistaPrevia: true };
const WEBP: TipoArchivo = { mime: 'image/webp', extension: 'webp', vistaPrevia: true };

const OFFICE_ZIP: Record<string, TipoArchivo> = {
  docx: {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: 'docx',
    vistaPrevia: false,
  },
  xlsx: {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx',
    vistaPrevia: false,
  },
  pptx: {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extension: 'pptx',
    vistaPrevia: false,
  },
};

const OFFICE_ANTIGUO: Record<string, TipoArchivo> = {
  doc: { mime: 'application/msword', extension: 'doc', vistaPrevia: false },
  xls: { mime: 'application/vnd.ms-excel', extension: 'xls', vistaPrevia: false },
};

function empiezaCon(contenido: Buffer, firma: readonly number[], desplazamiento = 0): boolean {
  return firma.every((byte, indice) => contenido[desplazamiento + indice] === byte);
}

function extensionDe(nombre: string): string {
  const partes = nombre.toLowerCase().split('.');
  return partes.length > 1 ? (partes.at(-1) ?? '') : '';
}

export function detectarTipoArchivo(contenido: Buffer, nombreOriginal: string): TipoArchivo | null {
  if (empiezaCon(contenido, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return PDF;
  }

  if (empiezaCon(contenido, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return PNG;
  }

  if (empiezaCon(contenido, [0xff, 0xd8, 0xff])) {
    return JPEG;
  }

  if (empiezaCon(contenido, [0x52, 0x49, 0x46, 0x46]) && empiezaCon(contenido, [0x57, 0x45, 0x42, 0x50], 8)) {
    return WEBP;
  }

  const extension = extensionDe(nombreOriginal);

  if (empiezaCon(contenido, [0x50, 0x4b, 0x03, 0x04])) {
    return OFFICE_ZIP[extension] ?? null;
  }

  if (empiezaCon(contenido, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return OFFICE_ANTIGUO[extension] ?? null;
  }

  return null;
}

export function nombreSeguro(nombreOriginal: string): string {
  const limpio = nombreOriginal
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\p{Cc}]/gu, '_')
    .trim()
    .slice(0, 180);

  return limpio === '' ? 'archivo' : limpio;
}
