import { extensionDeNombre } from '@sige/types';
import { detectarTipoArchivo, type TipoArchivo } from '../storage/file-signature';

const ZIP: TipoArchivo = { mime: 'application/zip', extension: 'zip', vistaPrevia: false };
const PPT: TipoArchivo = { mime: 'application/vnd.ms-powerpoint', extension: 'ppt', vistaPrevia: false };
const CSV: TipoArchivo = { mime: 'text/csv', extension: 'csv', vistaPrevia: false };
const TXT: TipoArchivo = { mime: 'text/plain', extension: 'txt', vistaPrevia: false };

export const MIMES_OFFICE = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

function pareceTexto(cabecera: Buffer): boolean {
  if (cabecera.includes(0)) {
    return false;
  }

  const texto = cabecera.toString('utf8');
  const reemplazos = texto.split('�').length - 1;
  return reemplazos <= 2;
}

export function detectarTipoSubida(cabecera: Buffer, nombre: string): TipoArchivo | null {
  const extension = extensionDeNombre(nombre);
  const conocido = detectarTipoArchivo(cabecera, nombre);

  if (conocido !== null) {
    return conocido;
  }

  const esZip = cabecera.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  const esOle = cabecera.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));

  if (esZip && extension === 'zip') {
    return ZIP;
  }

  if (esOle && extension === 'ppt') {
    return PPT;
  }

  if ((extension === 'csv' || extension === 'txt') && pareceTexto(cabecera)) {
    return extension === 'csv' ? CSV : TXT;
  }

  return null;
}
