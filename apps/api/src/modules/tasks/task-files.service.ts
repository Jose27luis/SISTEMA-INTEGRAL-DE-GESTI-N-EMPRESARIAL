import { stat } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  extensionDeNombre,
  type HojasArchivo,
  type InfoArchivo,
  MAXIMO_COLUMNAS_TABLA,
  MAXIMO_FILAS_TABLA,
  tipoVistaDe,
} from '@sige/types';
import { Workbook } from 'exceljs';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aIso } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
import { filtroDocumentosVisibles } from '../documents/document-visibility';
import { filtroProyectosVisibles } from '../projects/project-visibility';
import { AlmacenArchivos } from '../storage/file-storage';
import { MIMES_OFFICE } from '../uploads/upload-type';
import { AccesoTareasService } from './task-access.service';

const TIPOS_CON_VISTA_PREVIA = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
const MAXIMO_BYTES_TABLA = 25 * 1024 * 1024;
const MAXIMO_BYTES_CSV = 4 * 1024 * 1024;

export interface ArchivoParaEntregar {
  nombre: string;
  mime: string;
  tamanoBytes: number;
  enLinea: boolean;
  huella: string;
  rango: { inicio: number; fin: number } | null;
  flujo: Readable;
}

type ArchivoAutorizado = Prisma.ArchivoGetPayload<{
  include: { subidoPor: { select: { nombre: true } }; vistaPrevia: true };
}> & { tareaId: string | null; documentoId: string | null; version: number | null };

function leerRango(cabecera: string | undefined, tamano: number): { inicio: number; fin: number } | null {
  if (cabecera === undefined) {
    return null;
  }

  const coincidencia = /^bytes=(\d*)-(\d*)$/u.exec(cabecera.trim());

  if (coincidencia === null) {
    return null;
  }

  const [, desde = '', hasta = ''] = coincidencia;

  if (desde === '' && hasta === '') {
    return null;
  }

  const inicio = desde === '' ? Math.max(tamano - Number(hasta), 0) : Number(desde);
  const fin = desde === '' || hasta === '' ? tamano - 1 : Math.min(Number(hasta), tamano - 1);

  if (inicio > fin || inicio >= tamano) {
    throw new HttpException({ mensaje: 'Rango no válido.', errores: [] }, HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
  }

  return { inicio, fin };
}

function separarCsv(linea: string, separador: string): string[] {
  const celdas: string[] = [];
  let actual = '';
  let entreComillas = false;

  for (let indice = 0; indice < linea.length; indice += 1) {
    const caracter = linea.charAt(indice);

    if (caracter === '"') {
      if (entreComillas && linea.charAt(indice + 1) === '"') {
        actual += '"';
        indice += 1;
      } else {
        entreComillas = !entreComillas;
      }
    } else if (caracter === separador && !entreComillas) {
      celdas.push(actual);
      actual = '';
    } else {
      actual += caracter;
    }
  }

  celdas.push(actual);
  return celdas;
}

function textoCelda(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return '';
  }

  if (valor instanceof Date) {
    return valor.toISOString().slice(0, 10);
  }

  if (typeof valor === 'object') {
    const objeto = valor as { text?: unknown; result?: unknown; richText?: { text: string }[]; hyperlink?: unknown };

    if (Array.isArray(objeto.richText)) {
      return objeto.richText.map(({ text }) => text).join('');
    }

    if (objeto.result !== undefined) {
      return textoCelda(objeto.result);
    }

    if (typeof objeto.text === 'string') {
      return objeto.text;
    }

    return '';
  }

  return typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean' ? String(valor) : '';
}

@Injectable()
export class ArchivosTareaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoTareasService,
    private readonly auditoria: AuditoriaService,
    private readonly almacen: AlmacenArchivos,
  ) {}

  async entregar(
    archivoId: string,
    descargar: boolean,
    cabeceraRango: string | undefined,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<ArchivoParaEntregar> {
    const archivo = await this.autorizar(archivoId, usuario, contexto);
    const rango = leerRango(cabeceraRango, archivo.tamanoBytes);

    if (rango === null || rango.inicio === 0) {
      await this.auditarDescarga(archivo, descargar ? 'descarga' : 'vista', usuario, contexto);
    }

    return {
      nombre: archivo.nombreOriginal,
      mime: archivo.mime,
      tamanoBytes: archivo.tamanoBytes,
      enLinea: !descargar && TIPOS_CON_VISTA_PREVIA.has(archivo.mime),
      huella: archivo.sha256,
      rango,
      flujo: this.almacen.leer(archivo.rutaAlmacen, rango ?? undefined),
    };
  }

  async info(archivoId: string, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<InfoArchivo> {
    const archivo = await this.autorizar(archivoId, usuario, contexto);
    const tipo = tipoVistaDe(archivo.nombreOriginal, archivo.mime);
    const extension = extensionDeNombre(archivo.nombreOriginal);

    return {
      id: archivo.id,
      nombre: archivo.nombreOriginal,
      mime: archivo.mime,
      tamanoBytes: archivo.tamanoBytes,
      tipo,
      vistaPdf: tipo === 'pdf' ? 'LISTA' : MIMES_OFFICE.has(archivo.mime) ? (archivo.vistaPrevia?.estado ?? 'PENDIENTE') : 'NO_APLICA',
      tabla:
        (extension === 'xlsx' && archivo.tamanoBytes <= MAXIMO_BYTES_TABLA) ||
        (extension === 'csv' && archivo.tamanoBytes <= MAXIMO_BYTES_CSV * 4),
      subidoPor: archivo.subidoPor.nombre,
      subidoEn: aIso(archivo.subidoEn),
    };
  }

  async vista(
    archivoId: string,
    cabeceraRango: string | undefined,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<ArchivoParaEntregar> {
    const archivo = await this.autorizar(archivoId, usuario, contexto);

    if (archivo.mime === 'application/pdf') {
      return this.entregar(archivoId, false, cabeceraRango, usuario, contexto);
    }

    const vista = archivo.vistaPrevia;

    if (vista?.estado !== 'LISTA' || vista.rutaPdf === null) {
      throw new ConflictException({
        mensaje: vista?.estado === 'ERROR' ? 'No se pudo preparar la vista previa.' : 'La vista previa se está preparando.',
        errores: [{ campo: 'estado', mensaje: vista?.estado ?? 'PENDIENTE' }],
      });
    }

    const tamano = (await stat(this.almacen.rutaAbsoluta(vista.rutaPdf))).size;
    const rango = leerRango(cabeceraRango, tamano);

    if (rango === null || rango.inicio === 0) {
      await this.auditarDescarga(archivo, 'vista previa', usuario, contexto);
    }

    return {
      nombre: `${archivo.nombreOriginal}.pdf`,
      mime: 'application/pdf',
      tamanoBytes: tamano,
      enLinea: true,
      huella: `${archivo.sha256}-pdf`,
      rango,
      flujo: this.almacen.leer(vista.rutaPdf, rango ?? undefined),
    };
  }

  async hojas(archivoId: string, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<HojasArchivo> {
    const archivo = await this.autorizar(archivoId, usuario, contexto);
    const extension = extensionDeNombre(archivo.nombreOriginal);

    if (extension === 'csv') {
      return { hojas: [await this.leerCsv(archivo.rutaAlmacen, archivo.nombreOriginal)] };
    }

    if (extension !== 'xlsx' || archivo.tamanoBytes > MAXIMO_BYTES_TABLA) {
      throw new ConflictException({ mensaje: 'Este archivo no tiene vista de tabla.', errores: [] });
    }

    const libro = new Workbook();
    await libro.xlsx.read(this.almacen.leer(archivo.rutaAlmacen));

    return {
      hojas: libro.worksheets.map((hoja) => {
        const totalFilas = hoja.actualRowCount;
        const totalColumnas = hoja.actualColumnCount;
        const filas: string[][] = [];
        const columnas = Math.min(totalColumnas, MAXIMO_COLUMNAS_TABLA);

        hoja.eachRow({ includeEmpty: true }, (fila, numero) => {
          if (numero > MAXIMO_FILAS_TABLA) {
            return;
          }

          filas.push(Array.from({ length: columnas }, (_, indice) => textoCelda(fila.getCell(indice + 1).value)));
        });

        return {
          nombre: hoja.name,
          filas,
          totalFilas,
          totalColumnas,
          recortada: totalFilas > MAXIMO_FILAS_TABLA || totalColumnas > MAXIMO_COLUMNAS_TABLA,
        };
      }),
    };
  }

  private async leerCsv(ruta: string, nombre: string): Promise<HojasArchivo['hojas'][number]> {
    const trozos: Buffer[] = [];
    let leidos = 0;

    for await (const trozo of this.almacen.leer(ruta, { inicio: 0, fin: MAXIMO_BYTES_CSV - 1 })) {
      const bloque = trozo as Buffer;
      trozos.push(bloque);
      leidos += bloque.length;
    }

    const texto = Buffer.concat(trozos, leidos).toString('utf8').replace(/^﻿/u, '');
    const lineas = texto.split(/\r?\n/u).filter((linea, indice, todas) => linea !== '' || indice < todas.length - 1);
    const primera = lineas[0] ?? '';
    const separador = [';', ',', '\t'].reduce((mejor, opcion) =>
      primera.split(opcion).length > primera.split(mejor).length ? opcion : mejor,
    );
    const filas = lineas.slice(0, MAXIMO_FILAS_TABLA).map((linea) => separarCsv(linea, separador).slice(0, MAXIMO_COLUMNAS_TABLA));
    const totalColumnas = filas.reduce((maximo, fila) => Math.max(maximo, fila.length), 0);

    return {
      nombre: nombre.replace(/\.csv$/iu, ''),
      filas,
      totalFilas: lineas.length,
      totalColumnas,
      recortada: lineas.length > MAXIMO_FILAS_TABLA || leidos >= MAXIMO_BYTES_CSV,
    };
  }

  private async auditarDescarga(
    archivo: ArchivoAutorizado,
    modo: string,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    await this.auditoria.registrar({
      actor: actorDesde(usuario, contexto),
      accion: 'DESCARGAR',
      entidad: 'archivo',
      entidadId: archivo.id,
      despues: {
        nombre: archivo.nombreOriginal,
        tareaId: archivo.tareaId,
        documentoId: archivo.documentoId,
        version: archivo.version,
        modo,
      },
    });
  }

  private async primeraTareaVisible(
    tareaIds: readonly string[],
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<string> {
    let ultimoError: unknown = null;

    for (const id of tareaIds) {
      try {
        await this.acceso.obtenerVisible(usuario, id, contexto);
        return id;
      } catch (error) {
        ultimoError = error;
      }
    }

    throw ultimoError;
  }

  private async autorizar(archivoId: string, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<ArchivoAutorizado> {
    const archivo = await this.prisma.archivo.findUnique({
      where: { id: archivoId },
      include: {
        subidoPor: { select: { nombre: true } },
        vistaPrevia: true,
        evidencias: { take: 1, select: { avance: { select: { tareaId: true } } } },
        adjuntosTarea: { select: { tareaId: true } },
        versiones: { take: 1, select: { documentoId: true, numero: true } },
        vouchers: { take: 1, select: { id: true } },
        comprobantesEgreso: { take: 1, select: { id: true } },
        entregables: { take: 1, select: { etapa: { select: { proyectoId: true } } } },
      },
    });

    if (archivo === null) {
      throw new NotFoundException({ mensaje: 'El archivo no existe.', errores: [] });
    }

    const tareaIds = [
      ...new Set([
        ...archivo.evidencias.map(({ avance }) => avance.tareaId),
        ...archivo.adjuntosTarea.map(({ tareaId: id }) => id),
      ]),
    ];
    let tareaId: string | undefined = tareaIds[0];
    const version = archivo.versiones[0];
    const financiero = archivo.vouchers.length > 0 || archivo.comprobantesEgreso.length > 0;
    const proyectoId = archivo.entregables[0]?.etapa.proyectoId;
    const denegar = async (motivo: string): Promise<never> => {
      await this.auditoria.registrar({
        actor: actorDesde(usuario, contexto),
        accion: 'PERMISO_DENEGADO',
        entidad: 'archivo',
        entidadId: archivo.id,
        motivo,
      });

      throw new ForbiddenException({ mensaje: 'No tiene acceso a este archivo.', errores: [] });
    };

    if (proyectoId !== undefined) {
      const visible = usuario.permisos.has('proyecto:ver')
        ? await this.prisma.proyecto.count({ where: { AND: [{ id: proyectoId }, filtroProyectosVisibles(usuario)] } })
        : 0;

      if (visible === 0) {
        await denegar('Entregable de un proyecto fuera del alcance del usuario');
      }
    } else if (financiero) {
      const permitido =
        archivo.comprobantesEgreso.length > 0 ? usuario.permisos.has('finanza:egresos') : usuario.permisos.has('comercial:ver');

      if (!permitido) {
        await denegar('Archivo financiero sin permiso');
      }
    } else if (version !== undefined) {
      const visible = usuario.permisos.has('documento:ver')
        ? await this.prisma.documento.count({
            where: { AND: [{ id: version.documentoId }, filtroDocumentosVisibles(usuario)] },
          })
        : 0;

      if (visible === 0) {
        await denegar('Documento fuera del alcance del usuario');
      }
    } else if (tareaId === undefined) {
      const asignado =
        archivo.clienteId !== null &&
        (await this.prisma.asignacionCliente.count({
          where: { clienteId: archivo.clienteId, usuarioId: usuario.usuarioId, retiradoEn: null },
        })) > 0;

      if (!usuario.alcanceGlobal && !asignado && archivo.subidoPorId !== usuario.usuarioId) {
        throw new ForbiddenException({ mensaje: 'No tiene acceso a este archivo.', errores: [] });
      }
    } else {
      tareaId = await this.primeraTareaVisible(tareaIds, usuario, contexto);
    }

    return { ...archivo, tareaId: tareaId ?? null, documentoId: version?.documentoId ?? null, version: version?.numero ?? null };
  }
}
