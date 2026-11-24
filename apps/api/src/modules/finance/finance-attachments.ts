import { BadRequestException } from '@nestjs/common';
import { TAMANO_MAXIMO_ADJUNTO_FINANZAS_MB } from '@sige/types';
import type { ClienteBaseDatos } from '../audit/audit.service';
import { detectarTipoArchivo, nombreSeguro } from '../storage/file-signature';
import type { AlmacenArchivos, ArchivoGuardado } from '../storage/file-storage';

export interface AdjuntoRecibido {
  nombre: string;
  contenido: Buffer;
}

export interface AdjuntoGuardado extends ArchivoGuardado {
  nombre: string;
  mime: string;
}

const MIME_PERMITIDOS = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

function errorAdjunto(campo: string, mensaje: string): BadRequestException {
  return new BadRequestException({ mensaje: 'Revise el archivo adjunto.', errores: [{ campo, mensaje }] });
}

export async function guardarAdjuntoFinanciero(
  almacen: AlmacenArchivos,
  adjuntos: readonly AdjuntoRecibido[],
  carpeta: string,
  campo: string,
): Promise<AdjuntoGuardado | null> {
  const [adjunto, ...sobrantes] = adjuntos;

  if (adjunto === undefined) {
    return null;
  }

  if (sobrantes.length > 0) {
    throw errorAdjunto(campo, 'Adjunte un solo archivo.');
  }

  if (adjunto.contenido.length > TAMANO_MAXIMO_ADJUNTO_FINANZAS_MB * 1024 * 1024) {
    throw errorAdjunto(campo, `El archivo supera ${String(TAMANO_MAXIMO_ADJUNTO_FINANZAS_MB)} MB.`);
  }

  const nombre = nombreSeguro(adjunto.nombre);
  const tipo = detectarTipoArchivo(adjunto.contenido, nombre);

  if (tipo === null || !MIME_PERMITIDOS.has(tipo.mime)) {
    throw errorAdjunto(campo, 'Adjunte un PDF o una imagen JPG, PNG o WEBP.');
  }

  const guardado = await almacen.guardar(adjunto.contenido, carpeta, tipo.extension);
  return { ...guardado, nombre, mime: tipo.mime };
}

export async function registrarAdjunto(
  tx: ClienteBaseDatos,
  adjunto: AdjuntoGuardado,
  clienteId: string | null,
  usuarioId: string,
): Promise<string> {
  const archivo = await tx.archivo.create({
    data: {
      rutaAlmacen: adjunto.ruta,
      nombreOriginal: adjunto.nombre,
      mime: adjunto.mime,
      tamanoBytes: adjunto.tamanoBytes,
      sha256: adjunto.sha256,
      clienteId,
      subidoPorId: usuarioId,
    },
  });

  return archivo.id;
}
