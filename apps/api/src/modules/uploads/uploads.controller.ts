import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import { esquemaSubidaEntrada, type Subida, type SubidaCompleta, type SubidaEntrada } from '@sige/types';
import type { Request } from 'express';
import { z } from 'zod';
import type { UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { RequierePermiso, UsuarioActual } from '../../common/auth/decorators';
import { ValidacionZod } from '../../common/validation/zod-validation.pipe';
import { SubidasService } from './uploads.service';

const CABECERA_SUBIDA = 'x-sige-subida';
const validarId = new ValidacionZod(z.uuid());
const validarDesde = new ValidacionZod(z.coerce.number().int().nonnegative());

function exigirCabecera(valor: string | undefined): void {
  if (valor !== '1') {
    throw new ForbiddenException({ mensaje: 'Solicitud de subida no válida.', errores: [] });
  }
}

@Controller('subidas')
export class SubidasController {
  constructor(private readonly subidas: SubidasService) {}

  @Post()
  @RequierePermiso('tarea:ver')
  crear(
    @Body(new ValidacionZod(esquemaSubidaEntrada)) datos: SubidaEntrada,
    @Headers(CABECERA_SUBIDA) cabecera: string | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<Subida> {
    exigirCabecera(cabecera);
    return this.subidas.crear(datos, usuario.usuarioId);
  }

  @Get(':id')
  @RequierePermiso('tarea:ver')
  estado(@Param('id', validarId) id: string, @UsuarioActual() usuario: UsuarioAutenticado): Promise<Subida> {
    return this.subidas.estado(id, usuario.usuarioId);
  }

  @Put(':id/partes')
  @RequierePermiso('tarea:ver')
  recibirParte(
    @Param('id', validarId) id: string,
    @Query('desde', validarDesde) desde: number,
    @Headers(CABECERA_SUBIDA) cabecera: string | undefined,
    @Req() solicitud: Request,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<Subida> {
    exigirCabecera(cabecera);
    return this.subidas.recibirParte(id, desde, solicitud, usuario.usuarioId);
  }

  @Post(':id/finalizar')
  @HttpCode(200)
  @RequierePermiso('tarea:ver')
  finalizar(
    @Param('id', validarId) id: string,
    @Headers(CABECERA_SUBIDA) cabecera: string | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<SubidaCompleta> {
    exigirCabecera(cabecera);
    return this.subidas.finalizar(id, usuario.usuarioId);
  }
}
