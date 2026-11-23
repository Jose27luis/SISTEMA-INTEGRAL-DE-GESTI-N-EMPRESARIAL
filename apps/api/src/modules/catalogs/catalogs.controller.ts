import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import {
  type ElementoCatalogo,
  esquemaNombreCatalogo,
  esquemaTipoCatalogo,
  type NombreCatalogo,
  type TipoCatalogo,
} from '@sige/types';
import { z } from 'zod';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { Cliente, RequierePermiso, UsuarioActual } from '../../common/auth/decorators';
import { ValidacionZod } from '../../common/validation/zod-validation.pipe';
import { actorDesde } from '../audit/audit.service';
import { CatalogosService } from './catalogs.service';

const validarTipo = new ValidacionZod(esquemaTipoCatalogo);
const validarId = new ValidacionZod(z.uuid());

@Controller('catalogos')
export class CatalogosController {
  constructor(private readonly catalogos: CatalogosService) {}

  @Get(':tipo')
  listar(@Param('tipo', validarTipo) tipo: TipoCatalogo): Promise<ElementoCatalogo[]> {
    return this.catalogos.listar(tipo);
  }

  @Post(':tipo')
  @HttpCode(204)
  @RequierePermiso('catalogo:gestionar')
  crear(
    @Param('tipo', validarTipo) tipo: TipoCatalogo,
    @Body(new ValidacionZod(esquemaNombreCatalogo)) datos: NombreCatalogo,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.catalogos.crear(tipo, datos.nombre, actorDesde(usuario, cliente));
  }

  @Put(':tipo/:id')
  @HttpCode(204)
  @RequierePermiso('catalogo:gestionar')
  renombrar(
    @Param('tipo', validarTipo) tipo: TipoCatalogo,
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaNombreCatalogo)) datos: NombreCatalogo,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.catalogos.renombrar(tipo, id, datos.nombre, actorDesde(usuario, cliente));
  }

  @Post(':tipo/:id/activacion')
  @HttpCode(204)
  @RequierePermiso('catalogo:gestionar')
  activar(
    @Param('tipo', validarTipo) tipo: TipoCatalogo,
    @Param('id', validarId) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.catalogos.cambiarEstado(tipo, id, true, actorDesde(usuario, cliente));
  }

  @Post(':tipo/:id/desactivacion')
  @HttpCode(204)
  @RequierePermiso('catalogo:gestionar')
  desactivar(
    @Param('tipo', validarTipo) tipo: TipoCatalogo,
    @Param('id', validarId) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.catalogos.cambiarEstado(tipo, id, false, actorDesde(usuario, cliente));
  }
}
