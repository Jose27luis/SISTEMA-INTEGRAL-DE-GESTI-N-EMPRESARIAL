import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  HORAS_VIGENCIA_SUBIDA,
  type Subida,
  type SubidaCompleta,
  type SubidaEntrada,
  TAMANO_PARTE_SUBIDA,
} from '@sige/types';
import { PrismaService } from '../../prisma/prisma.service';
import type { ClienteBaseDatos } from '../audit/audit.service';
import { nombreSeguro } from '../storage/file-signature';
import { AlmacenArchivos } from '../storage/file-storage';
import { detectarTipoSubida } from './upload-type';

const BYTES_CABECERA = 8192;

export interface ArchivoAdjunto {
  id: string;
  nombre: string;
}

function errorCampo(campo: string, mensaje: string): BadRequestException {
  return new BadRequestException({ mensaje: 'Revise el archivo.', errores: [{ campo, mensaje }] });
}

@Injectable()
export class SubidasService {
  private readonly registro = new Logger(SubidasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly almacen: AlmacenArchivos,
  ) {}

  async crear(entrada: SubidaEntrada, usuarioId: string): Promise<Subida> {
    const id = randomUUID();
    const rutaTemporal = `_subidas/${id}.parte`;
    const absoluta = this.almacen.rutaAbsoluta(rutaTemporal);

    await mkdir(dirname(absoluta), { recursive: true, mode: 0o750 });
    await (await open(absoluta, 'w', 0o640)).close();

    const subida = await this.prisma.subida.create({
      data: {
        id,
        usuarioId,
        nombre: nombreSeguro(entrada.nombre),
        tamanoBytes: entrada.tamanoBytes,
        rutaTemporal,
        expiraEn: new Date(Date.now() + HORAS_VIGENCIA_SUBIDA * 3_600_000),
      },
    });

    return this.aSubida(subida);
  }

  async estado(id: string, usuarioId: string): Promise<Subida> {
    return this.aSubida(await this.propia(id, usuarioId));
  }

  async recibirParte(id: string, desde: number, flujo: Readable, usuarioId: string): Promise<Subida> {
    const subida = await this.propia(id, usuarioId);

    if (subida.estado !== 'EN_CURSO') {
      throw new ConflictException({ mensaje: 'La subida ya terminó.', errores: [] });
    }

    if (desde !== subida.recibidos) {
      throw new ConflictException({
        mensaje: `El servidor tiene ${String(subida.recibidos)} bytes; continúe desde ahí.`,
        errores: [{ campo: 'desde', mensaje: String(subida.recibidos) }],
      });
    }

    const limite = Math.min(TAMANO_PARTE_SUBIDA, subida.tamanoBytes - desde);
    let recibidos = 0;
    const contador = new Transform({
      transform(trozo: Buffer, _codificacion, listo) {
        recibidos += trozo.length;

        if (recibidos > limite) {
          listo(new PayloadTooLargeException({ mensaje: 'La parte es más grande de lo permitido.', errores: [] }));
          return;
        }

        listo(null, trozo);
      },
    });

    await pipeline(
      flujo,
      contador,
      createWriteStream(this.almacen.rutaAbsoluta(subida.rutaTemporal), { flags: 'r+', start: desde }),
    );

    if (recibidos === 0) {
      throw errorCampo('archivo', 'La parte llegó vacía.');
    }

    const { count } = await this.prisma.subida.updateMany({
      where: { id, recibidos: desde, estado: 'EN_CURSO' },
      data: { recibidos: desde + recibidos },
    });

    if (count === 0) {
      throw new ConflictException({ mensaje: 'Otra parte se guardó al mismo tiempo. Reintente.', errores: [] });
    }

    return { ...this.aSubida(subida), recibidos: desde + recibidos };
  }

  async finalizar(id: string, usuarioId: string): Promise<SubidaCompleta> {
    const subida = await this.propia(id, usuarioId);

    if (subida.estado === 'COMPLETA' && subida.mime !== null) {
      return { id, nombre: subida.nombre, mime: subida.mime, tamanoBytes: subida.tamanoBytes };
    }

    if (subida.estado !== 'EN_CURSO') {
      throw new ConflictException({ mensaje: 'La subida ya no está disponible.', errores: [] });
    }

    if (subida.recibidos !== subida.tamanoBytes) {
      throw new ConflictException({ mensaje: 'Todavía faltan partes del archivo.', errores: [] });
    }

    const temporal = this.almacen.rutaAbsoluta(subida.rutaTemporal);
    const manejador = await open(temporal, 'r');
    const cabecera = Buffer.alloc(Math.min(BYTES_CABECERA, subida.tamanoBytes));
    await manejador.read(cabecera, 0, cabecera.length, 0);
    await manejador.close();
    const tipo = detectarTipoSubida(cabecera, subida.nombre);

    if (tipo === null) {
      await this.descartar(subida.id, temporal);
      throw errorCampo('archivo', 'El contenido del archivo no corresponde a un formato admitido.');
    }

    const huella = createHash('sha256');
    await pipeline(createReadStream(temporal), huella);
    const ahora = new Date();
    const rutaFinal = [
      'subidas',
      String(ahora.getUTCFullYear()),
      String(ahora.getUTCMonth() + 1).padStart(2, '0'),
      `${randomUUID()}.${tipo.extension}`,
    ].join('/');
    const destino = this.almacen.rutaAbsoluta(rutaFinal);

    await mkdir(dirname(destino), { recursive: true, mode: 0o750 });
    await rename(temporal, destino);
    await this.prisma.subida.update({
      where: { id },
      data: { estado: 'COMPLETA', rutaFinal, mime: tipo.mime, sha256: huella.digest('hex') },
    });

    return { id, nombre: subida.nombre, mime: tipo.mime, tamanoBytes: subida.tamanoBytes };
  }

  async consumir(
    tx: ClienteBaseDatos,
    subidaIds: readonly string[],
    usuarioId: string,
    clienteId: string | null,
  ): Promise<ArchivoAdjunto[]> {
    if (subidaIds.length === 0) {
      return [];
    }

    const unicas = [...new Set(subidaIds)];
    const subidas = await tx.subida.findMany({ where: { id: { in: unicas } } });
    const adjuntos: ArchivoAdjunto[] = [];

    for (const id of unicas) {
      const subida = subidas.find((candidata) => candidata.id === id);

      if (
        subida === undefined ||
        subida.usuarioId !== usuarioId ||
        subida.estado !== 'COMPLETA' ||
        subida.rutaFinal === null ||
        subida.mime === null ||
        subida.sha256 === null ||
        subida.expiraEn < new Date()
      ) {
        throw errorCampo('subidaIds', 'Uno de los archivos ya no está disponible. Vuelva a adjuntarlo.');
      }

      const archivo = await tx.archivo.create({
        data: {
          rutaAlmacen: subida.rutaFinal,
          nombreOriginal: subida.nombre,
          mime: subida.mime,
          tamanoBytes: subida.tamanoBytes,
          sha256: subida.sha256,
          clienteId,
          subidoPorId: usuarioId,
        },
      });
      const { count } = await tx.subida.updateMany({
        where: { id, estado: 'COMPLETA' },
        data: { estado: 'USADA', archivoId: archivo.id },
      });

      if (count === 0) {
        throw errorCampo('subidaIds', 'Uno de los archivos ya se adjuntó en otro registro.');
      }

      adjuntos.push({ id: archivo.id, nombre: subida.nombre });
    }

    return adjuntos;
  }

  async expirar(): Promise<number> {
    const vencidas = await this.prisma.subida.findMany({
      where: { estado: { in: ['EN_CURSO', 'COMPLETA'] }, expiraEn: { lt: new Date() } },
      select: { id: true, rutaTemporal: true, rutaFinal: true },
      take: 500,
    });

    for (const subida of vencidas) {
      const ruta = subida.rutaFinal ?? subida.rutaTemporal;
      await rm(this.almacen.rutaAbsoluta(ruta), { force: true }).catch((error: unknown) => {
        this.registro.warn(`No se pudo borrar ${ruta}: ${error instanceof Error ? error.message : String(error)}`);
      });
      await this.prisma.subida.update({ where: { id: subida.id }, data: { estado: 'EXPIRADA' } });
    }

    return vencidas.length;
  }

  private async descartar(id: string, temporal: string): Promise<void> {
    await rm(temporal, { force: true });
    await this.prisma.subida.update({ where: { id }, data: { estado: 'EXPIRADA' } });
  }

  private async propia(id: string, usuarioId: string): Promise<Prisma.SubidaGetPayload<object>> {
    const subida = await this.prisma.subida.findUnique({ where: { id } });

    if (subida === null) {
      throw new NotFoundException({ mensaje: 'La subida no existe.', errores: [] });
    }

    if (subida.usuarioId !== usuarioId) {
      throw new ForbiddenException({ mensaje: 'La subida pertenece a otro usuario.', errores: [] });
    }

    if (subida.estado === 'EXPIRADA' || subida.expiraEn < new Date()) {
      throw new GoneException({ mensaje: 'La subida venció. Vuelva a adjuntar el archivo.', errores: [] });
    }

    return subida;
  }

  private aSubida(subida: { id: string; estado: Subida['estado']; recibidos: number; tamanoBytes: number }): Subida {
    return {
      id: subida.id,
      estado: subida.estado,
      recibidos: subida.recibidos,
      tamanoBytes: subida.tamanoBytes,
      tamanoParte: TAMANO_PARTE_SUBIDA,
    };
  }
}
