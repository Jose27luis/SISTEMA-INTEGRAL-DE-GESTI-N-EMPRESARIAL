import type { Readable } from 'node:stream';

export interface ArchivoGuardado {
  ruta: string;
  sha256: string;
  tamanoBytes: number;
}

export abstract class AlmacenArchivos {
  abstract guardar(contenido: Buffer, carpeta: string, extension: string): Promise<ArchivoGuardado>;

  abstract leer(ruta: string, rango?: { inicio: number; fin: number }): Readable;

  abstract rutaAbsoluta(ruta: string): string;
}
