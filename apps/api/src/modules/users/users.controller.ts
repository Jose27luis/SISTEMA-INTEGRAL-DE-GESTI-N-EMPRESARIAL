import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import {
  type AsignacionRoles,
  esquemaAsignacionRoles,
  esquemaMotivo,
  esquemaRestablecimientoContrasena,
  type Motivo,
  type RestablecimientoContrasena,
  type UsuarioDetalle,
  type UsuarioResumen,
} from '@sige/types';
import { z } from 'zod';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { Cliente, RequierePermiso, UsuarioActual } from '../../common/auth/decorators';
import { ValidacionZod } from '../../common/validation/zod-validation.pipe';
import { actorDesde } from '../audit/audit.service';
import { GestionUsuariosService } from './users-management.service';
import { ConsultaUsuariosService } from './users-query.service';

const validarId = new ValidacionZod(z.uuid());
const validarMotivo = new ValidacionZod(esquemaMotivo);

@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly consulta: ConsultaUsuariosService,
    private readonly gestion: GestionUsuariosService,
  ) {}

  @Get()
  @RequierePermiso('usuario:ver')
  listar(): Promise<UsuarioResumen[]> {
    return this.consulta.listar();
  }

  @Get(':id')
  @RequierePermiso('usuario:ver')
  obtener(@Param('id', validarId) id: string): Promise<UsuarioDetalle> {
    return this.consulta.obtener(id);
  }

  @Put(':id/roles')
  @RequierePermiso('usuario:gestionar')
  asignarRoles(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaAsignacionRoles)) datos: AsignacionRoles,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<UsuarioDetalle> {
    return this.gestion.asignarRoles(id, datos.rolIds, actorDesde(usuario, cliente));
  }

  @Post(':id/desactivacion')
  @HttpCode(200)
  @RequierePermiso('usuario:gestionar')
  desactivar(
    @Param('id', validarId) id: string,
    @Body(validarMotivo) datos: Motivo,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<UsuarioDetalle> {
    return this.gestion.desactivar(id, datos.motivo, actorDesde(usuario, cliente));
  }

  @Post(':id/activacion')
  @HttpCode(200)
  @RequierePermiso('usuario:gestionar')
  activar(
    @Param('id', validarId) id: string,
    @Body(validarMotivo) datos: Motivo,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<UsuarioDetalle> {
    return this.gestion.activar(id, datos.motivo, actorDesde(usuario, cliente));
  }

  @Post(':id/revocacion-sesiones')
  @HttpCode(200)
  @RequierePermiso('sesion:revocar')
  revocarSesiones(
    @Param('id', validarId) id: string,
    @Body(validarMotivo) datos: Motivo,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<UsuarioDetalle> {
    return this.gestion.revocarSesiones(id, datos.motivo, actorDesde(usuario, cliente));
  }

  @Post(':id/restablecimiento-contrasena')
  @HttpCode(200)
  @RequierePermiso('usuario:gestionar')
  restablecerContrasena(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaRestablecimientoContrasena)) datos: RestablecimientoContrasena,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<UsuarioDetalle> {
    return this.gestion.restablecerContrasena(id, datos, actorDesde(usuario, cliente));
  }

  @Post(':id/restablecimiento-mfa')
  @HttpCode(200)
  @RequierePermiso('usuario:gestionar')
  restablecerMfa(
    @Param('id', validarId) id: string,
    @Body(validarMotivo) datos: Motivo,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<UsuarioDetalle> {
    return this.gestion.restablecerMfa(id, datos.motivo, actorDesde(usuario, cliente));
  }
}
