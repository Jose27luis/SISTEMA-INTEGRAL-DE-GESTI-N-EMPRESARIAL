import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import {
  type CreacionRol,
  type EdicionRol,
  esquemaCreacionRol,
  esquemaEdicionRol,
  type Permiso,
  type RolResumen,
} from '@sige/types';
import { z } from 'zod';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { Cliente, RequierePermiso, UsuarioActual } from '../../common/auth/decorators';
import { ValidacionZod } from '../../common/validation/zod-validation.pipe';
import { actorDesde } from '../audit/audit.service';
import { GestionRolesService } from './roles-command.service';
import { ConsultaRolesService } from './roles-query.service';

const validarId = new ValidacionZod(z.uuid());

@Controller()
export class RolesController {
  constructor(
    private readonly consulta: ConsultaRolesService,
    private readonly gestion: GestionRolesService,
  ) {}

  @Get('permisos')
  @RequierePermiso('rol:ver')
  listarPermisos(): Promise<Permiso[]> {
    return this.consulta.listarPermisos();
  }

  @Get('roles')
  @RequierePermiso('rol:ver')
  listar(): Promise<RolResumen[]> {
    return this.consulta.listar();
  }

  @Get('roles/:id')
  @RequierePermiso('rol:ver')
  obtener(@Param('id', validarId) id: string): Promise<RolResumen> {
    return this.consulta.obtener(id);
  }

  @Post('roles')
  @RequierePermiso('rol:gestionar')
  crear(
    @Body(new ValidacionZod(esquemaCreacionRol)) datos: CreacionRol,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<RolResumen> {
    return this.gestion.crear(datos, actorDesde(usuario, cliente));
  }

  @Put('roles/:id')
  @RequierePermiso('rol:gestionar')
  editar(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaEdicionRol)) datos: EdicionRol,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<RolResumen> {
    return this.gestion.editar(id, datos, actorDesde(usuario, cliente));
  }

  @Post('roles/:id/desactivacion')
  @HttpCode(200)
  @RequierePermiso('rol:gestionar')
  desactivar(
    @Param('id', validarId) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<RolResumen> {
    return this.gestion.desactivar(id, actorDesde(usuario, cliente));
  }

  @Post('roles/:id/activacion')
  @HttpCode(200)
  @RequierePermiso('rol:gestionar')
  activar(
    @Param('id', validarId) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<RolResumen> {
    return this.gestion.activar(id, actorDesde(usuario, cliente));
  }
}
