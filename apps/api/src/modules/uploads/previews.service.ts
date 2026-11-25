import { randomUUID } from 'node:crypto';
import { openAsBlob } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { extensionDeNombre } from '@sige/types';
import type { Entorno } from '../../config/environment';
import { ENTORNO } from '../../config/environment.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AlmacenArchivos } from '../storage/file-storage';
import { MIMES_OFFICE } from './upload-type';

const MAXIMO_INTENTOS = 3;
const POR_LOTE = 4;
const TIEMPO_MAXIMO_MS = 180_000;
const MINUTOS_ATASCO = 10;

export interface ResultadoLote {
  listas: number;
  errores: number;
}

@Injectable()
export class VistasPreviasService {
  private readonly registro = new Logger(VistasPreviasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly almacen: AlmacenArchivos,
    @Inject(ENTORNO) private readonly entorno: Entorno,
  ) {}

  async encolarFaltantes(): Promise<number> {
    const archivos = await this.prisma.archivo.findMany({
      where: { mime: { in: [...MIMES_OFFICE] }, vistaPrevia: null },
      select: { id: true },
      take: 200,
    });

    if (archivos.length > 0) {
      await this.prisma.vistaPrevia.createMany({
        data: archivos.map(({ id }) => ({ archivoId: id })),
        skipDuplicates: true,
      });
    }

    return archivos.length;
  }

  async procesarLote(): Promise<ResultadoLote> {
    await this.prisma.vistaPrevia.updateMany({
      where: { estado: 'PROCESANDO', actualizadoEn: { lt: new Date(Date.now() - MINUTOS_ATASCO * 60_000) } },
      data: { estado: 'PENDIENTE' },
    });

    const pendientes = await this.prisma.vistaPrevia.findMany({
      where: { estado: 'PENDIENTE', intentos: { lt: MAXIMO_INTENTOS } },
      orderBy: { creadoEn: 'asc' },
      take: POR_LOTE,
      include: { archivo: { select: { id: true, rutaAlmacen: true, nombreOriginal: true, clienteId: true } } },
    });
    const resultado: ResultadoLote = { listas: 0, errores: 0 };

    for (const pendiente of pendientes) {
      const { count } = await this.prisma.vistaPrevia.updateMany({
        where: { archivoId: pendiente.archivoId, estado: 'PENDIENTE' },
        data: { estado: 'PROCESANDO', intentos: { increment: 1 } },
      });

      if (count === 0) {
        continue;
      }

      try {
        const rutaPdf = await this.convertir(pendiente.archivo);
        await this.prisma.vistaPrevia.update({
          where: { archivoId: pendiente.archivoId },
          data: { estado: 'LISTA', rutaPdf, error: null },
        });
        resultado.listas += 1;
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : String(error);
        this.registro.warn(`No se pudo convertir ${pendiente.archivo.nombreOriginal}: ${mensaje}`);
        await this.prisma.vistaPrevia.update({
          where: { archivoId: pendiente.archivoId },
          data: {
            estado: pendiente.intentos + 1 >= MAXIMO_INTENTOS ? 'ERROR' : 'PENDIENTE',
            error: mensaje.slice(0, 500),
          },
        });
        resultado.errores += 1;
      }
    }

    return resultado;
  }

  private async convertir(archivo: { id: string; rutaAlmacen: string; nombreOriginal: string; clienteId: string | null }): Promise<string> {
    const origen = this.almacen.rutaAbsoluta(archivo.rutaAlmacen);
    const tamano = (await stat(origen)).size;
    const formulario = new FormData();
    const extension = extensionDeNombre(archivo.nombreOriginal) || 'docx';
    const contenido = await openAsBlob(origen);

    formulario.append('files', contenido, `documento.${extension}`);

    const respuesta = await fetch(`${this.entorno.CONVERSOR_URL}/forms/libreoffice/convert`, {
      method: 'POST',
      body: formulario,
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });

    if (!respuesta.ok) {
      throw new Error(`El conversor respondió ${String(respuesta.status)} para ${String(tamano)} bytes`);
    }

    const pdf = Buffer.from(await respuesta.arrayBuffer());

    if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new Error('El conversor no devolvió un PDF');
    }

    const ahora = new Date();
    const ruta = [
      archivo.clienteId === null ? 'vistas' : `clientes/${archivo.clienteId}/vistas`,
      String(ahora.getUTCFullYear()),
      String(ahora.getUTCMonth() + 1).padStart(2, '0'),
      `${randomUUID()}.pdf`,
    ].join('/');
    const destino = this.almacen.rutaAbsoluta(ruta);

    await mkdir(dirname(destino), { recursive: true, mode: 0o750 });
    await writeFile(destino, pdf, { flag: 'wx', mode: 0o640 });

    return ruta;
  }
}
