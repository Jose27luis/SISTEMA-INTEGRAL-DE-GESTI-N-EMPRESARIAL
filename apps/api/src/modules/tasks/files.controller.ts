import { Controller, Get, Headers, Param, Query, Res } from '@nestjs/common';
import type { HojasArchivo, InfoArchivo } from '@sige/types';
import type { Response } from 'express';
import { z } from 'zod';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { Cliente, RequierePermiso, UsuarioActual } from '../../common/auth/decorators';
import { ValidacionZod } from '../../common/validation/zod-validation.pipe';
import { type ArchivoParaEntregar, ArchivosTareaService } from './task-files.service';

const validarId = new ValidacionZod(z.uuid());

function enviar(archivo: ArchivoParaEntregar, siNoCoincide: string | undefined, respuesta: Response): void {
  const etiqueta = `"${archivo.huella}"`;
  const nombre = encodeURIComponent(archivo.nombre);

  respuesta.setHeader('ETag', etiqueta);
  respuesta.setHeader('Accept-Ranges', 'bytes');
  respuesta.setHeader('Cache-Control', 'private, no-cache');
  respuesta.setHeader('X-Content-Type-Options', 'nosniff');
  respuesta.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  respuesta.setHeader('Content-Type', archivo.mime);
  respuesta.setHeader(
    'Content-Disposition',
    `${archivo.enLinea ? 'inline' : 'attachment'}; filename="archivo"; filename*=UTF-8''${nombre}`,
  );

  if (siNoCoincide === etiqueta && archivo.rango === null) {
    archivo.flujo.destroy();
    respuesta.status(304).end();
    return;
  }

  if (archivo.rango === null) {
    respuesta.setHeader('Content-Length', String(archivo.tamanoBytes));
  } else {
    respuesta.status(206);
    respuesta.setHeader(
      'Content-Range',
      `bytes ${String(archivo.rango.inicio)}-${String(archivo.rango.fin)}/${String(archivo.tamanoBytes)}`,
    );
    respuesta.setHeader('Content-Length', String(archivo.rango.fin - archivo.rango.inicio + 1));
  }

  archivo.flujo.on('error', () => {
    if (!respuesta.headersSent) {
      respuesta.status(404).json({ mensaje: 'El archivo no está disponible.', errores: [] });
    } else {
      respuesta.end();
    }
  });
  respuesta.on('close', () => {
    archivo.flujo.destroy();
  });
  archivo.flujo.pipe(respuesta);
}

@Controller('archivos')
export class ArchivosController {
  constructor(private readonly archivos: ArchivosTareaService) {}

  @Get(':id/info')
  @RequierePermiso('tarea:ver')
  info(
    @Param('id', validarId) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<InfoArchivo> {
    return this.archivos.info(id, usuario, cliente);
  }

  @Get(':id/hojas')
  @RequierePermiso('tarea:ver')
  hojas(
    @Param('id', validarId) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<HojasArchivo> {
    return this.archivos.hojas(id, usuario, cliente);
  }

  @Get(':id/vista')
  @RequierePermiso('tarea:ver')
  async vista(
    @Param('id', validarId) id: string,
    @Headers('range') rango: string | undefined,
    @Headers('if-none-match') siNoCoincide: string | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
    @Res() respuesta: Response,
  ): Promise<void> {
    enviar(await this.archivos.vista(id, rango, usuario, cliente), siNoCoincide, respuesta);
  }

  @Get(':id')
  @RequierePermiso('tarea:ver')
  async entregar(
    @Param('id', validarId) id: string,
    @Query('descarga', new ValidacionZod(z.enum(['1']).optional())) descarga: '1' | undefined,
    @Headers('range') rango: string | undefined,
    @Headers('if-none-match') siNoCoincide: string | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
    @Res() respuesta: Response,
  ): Promise<void> {
    enviar(await this.archivos.entregar(id, descarga === '1', rango, usuario, cliente), siNoCoincide, respuesta);
  }
}
