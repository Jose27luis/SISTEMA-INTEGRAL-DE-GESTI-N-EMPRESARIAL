import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, normalize, relative, sep } from 'node:path';
import type { Readable } from 'node:stream';
import { Inject, Injectable } from '@nestjs/common';
import type { Entorno } from '../../config/environment';
import { ENTORNO } from '../../config/environment.module';
import { AlmacenArchivos, type ArchivoGuardado } from './file-storage';

@Injectable()
export class AlmacenArchivosLocal extends AlmacenArchivos {
  private readonly raiz: string;

  constructor(@Inject(ENTORNO) entorno: Entorno) {
    super();
    this.raiz = normalize(entorno.DIRECTORIO_ARCHIVOS);
  }

  async guardar(contenido: Buffer, carpeta: string, extension: string): Promise<ArchivoGuardado> {
    const ahora = new Date();
    const ruta = [
      carpeta,
      String(ahora.getUTCFullYear()),
      String(ahora.getUTCMonth() + 1).padStart(2, '0'),
      `${randomUUID()}.${extension}`,
    ].join('/');
    const destino = this.resolver(ruta);

    await mkdir(join(destino, '..'), { recursive: true, mode: 0o750 });
    await writeFile(destino, contenido, { flag: 'wx', mode: 0o640 });

    return {
      ruta,
      sha256: createHash('sha256').update(contenido).digest('hex'),
      tamanoBytes: contenido.length,
    };
  }

  leer(ruta: string, rango?: { inicio: number; fin: number }): Readable {
    return createReadStream(this.resolver(ruta), rango === undefined ? {} : { start: rango.inicio, end: rango.fin });
  }

  rutaAbsoluta(ruta: string): string {
    return this.resolver(ruta);
  }

  private resolver(ruta: string): string {
    const absoluta = normalize(join(this.raiz, ruta));
    const relativa = relative(this.raiz, absoluta);

    if (relativa.startsWith('..') || relativa.startsWith(sep)) {
      throw new Error('Ruta de archivo fuera del almacén');
    }

    return absoluta;
  }
}
