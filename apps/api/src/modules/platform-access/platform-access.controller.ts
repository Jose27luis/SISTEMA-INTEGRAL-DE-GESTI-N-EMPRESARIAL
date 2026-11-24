import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { type AccesoEntrada, type AccesosCliente, esquemaAccesoEntrada, type Plataforma } from '@sige/types';
import { z } from 'zod';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { Cliente, RequierePermiso, UsuarioActual } from '../../common/auth/decorators';
import { ValidacionZod } from '../../common/validation/zod-validation.pipe';
import { AccesosPlataformaService } from './platform-access.service';

const validarId = new ValidacionZod(z.uuid());

@Controller('accesos')
export class AccesosPlataformaController {
  constructor(private readonly accesos: AccesosPlataformaService) {}

  @Get('plataformas')
  @RequierePermiso('acceso:ver')
  plataformas(): Promise<Plataforma[]> {
    return this.accesos.plataformas();
  }

  @Get('clientes/:clienteId')
  @RequierePermiso('acceso:ver')
  listar(
    @Param('clienteId', validarId) clienteId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<AccesosCliente> {
    return this.accesos.listar(clienteId, usuario, cliente);
  }

  @Post('clientes/:clienteId')
  @HttpCode(204)
  @RequierePermiso('acceso:gestionar')
  crear(
    @Param('clienteId', validarId) clienteId: string,
    @Body(new ValidacionZod(esquemaAccesoEntrada)) datos: AccesoEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.accesos.guardar(clienteId, null, datos, usuario, cliente);
  }

  @Put('clientes/:clienteId/:accesoId')
  @HttpCode(204)
  @RequierePermiso('acceso:gestionar')
  editar(
    @Param('clienteId', validarId) clienteId: string,
    @Param('accesoId', validarId) accesoId: string,
    @Body(new ValidacionZod(esquemaAccesoEntrada)) datos: AccesoEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.accesos.guardar(clienteId, accesoId, datos, usuario, cliente);
  }
}
