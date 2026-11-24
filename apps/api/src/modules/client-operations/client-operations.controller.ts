import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  type CambioIncidencia,
  esquemaCambioIncidencia,
  esquemaIncidenciaEntrada,
  type FichaOperativa,
  type IncidenciaEntrada,
} from '@sige/types';
import { z } from 'zod';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { Cliente, RequierePermiso, UsuarioActual } from '../../common/auth/decorators';
import { ValidacionZod } from '../../common/validation/zod-validation.pipe';
import { OperacionClienteService } from './client-operations.service';

const validarId = new ValidacionZod(z.uuid());

@Controller('clientes')
export class OperacionClienteController {
  constructor(private readonly operacion: OperacionClienteService) {}

  @Get(':clienteId/ficha-operativa')
  @RequierePermiso('cliente:ver')
  ficha(
    @Param('clienteId', validarId) clienteId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<FichaOperativa> {
    return this.operacion.ficha(clienteId, usuario, cliente);
  }

  @Post(':clienteId/incidencias')
  @HttpCode(204)
  @RequierePermiso('incidencia:gestionar')
  registrar(
    @Param('clienteId', validarId) clienteId: string,
    @Body(new ValidacionZod(esquemaIncidenciaEntrada)) datos: IncidenciaEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.operacion.registrarIncidencia(clienteId, datos, usuario, cliente);
  }

  @Post(':clienteId/incidencias/:incidenciaId/estado')
  @HttpCode(204)
  @RequierePermiso('incidencia:gestionar')
  cambiarEstado(
    @Param('clienteId', validarId) clienteId: string,
    @Param('incidenciaId', validarId) incidenciaId: string,
    @Body(new ValidacionZod(esquemaCambioIncidencia)) datos: CambioIncidencia,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.operacion.cambiarEstado(clienteId, incidenciaId, datos, usuario, cliente);
  }
}
