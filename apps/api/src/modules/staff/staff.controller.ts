import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import {
  type AltaTrabajador,
  type CeseTrabajador,
  esquemaAltaTrabajador,
  esquemaCeseTrabajador,
  esquemaEstadoTrabajador,
  esquemaFichaTrabajador,
  esquemaReactivacionTrabajador,
  type EstadoTrabajador,
  type FichaTrabajador,
  type ReactivacionTrabajador,
  type TrabajadorDetalle,
  type TrabajadorResumen,
  type UsuarioSinFicha,
} from '@sige/types';
import { z } from 'zod';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { Cliente, RequierePermiso, UsuarioActual } from '../../common/auth/decorators';
import { ValidacionZod } from '../../common/validation/zod-validation.pipe';
import { actorDesde } from '../audit/audit.service';
import { GestionPersonalService } from './staff-command.service';
import { ConsultaPersonalService } from './staff-query.service';

const validarId = new ValidacionZod(z.uuid());
const validarEstado = new ValidacionZod(
  z
    .string()
    .optional()
    .transform((valor) => (valor === '' ? undefined : valor))
    .pipe(esquemaEstadoTrabajador.optional()),
);

@Controller('personal')
export class PersonalController {
  constructor(
    private readonly consulta: ConsultaPersonalService,
    private readonly gestion: GestionPersonalService,
  ) {}

  @Get()
  @RequierePermiso('personal:ver')
  listar(@Query('estado', validarEstado) estado: EstadoTrabajador | undefined): Promise<TrabajadorResumen[]> {
    return this.consulta.listar(estado);
  }

  @Get('usuarios-sin-ficha')
  @RequierePermiso('personal:gestionar')
  usuariosSinFicha(): Promise<UsuarioSinFicha[]> {
    return this.consulta.usuariosSinFicha();
  }

  @Get(':id')
  @RequierePermiso('personal:ver')
  obtener(@Param('id', validarId) id: string): Promise<TrabajadorDetalle> {
    return this.consulta.obtener(id);
  }

  @Post()
  @RequierePermiso('personal:gestionar')
  crear(
    @Body(new ValidacionZod(esquemaAltaTrabajador)) datos: AltaTrabajador,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<TrabajadorDetalle> {
    return this.gestion.crear(datos, actorDesde(usuario, cliente));
  }

  @Put(':id')
  @RequierePermiso('personal:gestionar')
  editar(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaFichaTrabajador)) datos: FichaTrabajador,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<TrabajadorDetalle> {
    return this.gestion.editar(id, datos, actorDesde(usuario, cliente));
  }

  @Post(':id/cese')
  @HttpCode(200)
  @RequierePermiso('personal:gestionar')
  cesar(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaCeseTrabajador)) datos: CeseTrabajador,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<TrabajadorDetalle> {
    return this.gestion.cesar(id, datos, actorDesde(usuario, cliente));
  }

  @Post(':id/reactivacion')
  @HttpCode(200)
  @RequierePermiso('personal:gestionar')
  reactivar(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaReactivacionTrabajador)) datos: ReactivacionTrabajador,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<TrabajadorDetalle> {
    return this.gestion.reactivar(id, datos.motivo, actorDesde(usuario, cliente));
  }
}
