import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { Cliente, RequierePermiso, UsuarioActual } from '../../common/auth/decorators';
import { ValidacionZod } from '../../common/validation/zod-validation.pipe';
import { ArchivosTareaService } from './task-files.service';

@Controller('archivos')
export class ArchivosController {
  constructor(private readonly archivos: ArchivosTareaService) {}

  @Get(':id')
  @RequierePermiso('tarea:ver')
  async entregar(
    @Param('id', new ValidacionZod(z.uuid())) id: string,
    @Query('descarga', new ValidacionZod(z.enum(['1']).optional())) descarga: '1' | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
    @Res() respuesta: Response,
  ): Promise<void> {
    const archivo = await this.archivos.entregar(id, descarga === '1', usuario, cliente);
    const nombre = encodeURIComponent(archivo.nombre);

    respuesta.setHeader('Content-Type', archivo.mime);
    respuesta.setHeader('Content-Length', String(archivo.tamanoBytes));
    respuesta.setHeader(
      'Content-Disposition',
      `${archivo.enLinea ? 'inline' : 'attachment'}; filename="archivo"; filename*=UTF-8''${nombre}`,
    );
    respuesta.setHeader('X-Content-Type-Options', 'nosniff');
    respuesta.setHeader('Cache-Control', 'private, no-store');
    respuesta.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");

    archivo.flujo.on('error', () => {
      if (!respuesta.headersSent) {
        respuesta.status(404).json({ mensaje: 'El archivo no está disponible.', errores: [] });
      } else {
        respuesta.end();
      }
    });
    archivo.flujo.pipe(respuesta);
  }
}
