import { Controller, Get, Query } from '@nestjs/common';
import {
  type BusquedaEntrada,
  esquemaBusquedaEntrada,
  esquemaFiltroEjecuciones,
  type FiltroEjecuciones,
  type ListaEjecuciones,
  type ResultadosBusqueda,
} from '@sige/types';
import type { UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { RequierePermiso, UsuarioActual } from '../../common/auth/decorators';
import { ValidacionZod } from '../../common/validation/zod-validation.pipe';
import { ProcesosService } from './processes.service';
import { BusquedaService } from './search.service';

@Controller()
export class BusquedaController {
  constructor(
    private readonly busqueda: BusquedaService,
    private readonly procesos: ProcesosService,
  ) {}

  @Get('busqueda')
  @RequierePermiso('tarea:ver')
  buscar(
    @Query(new ValidacionZod(esquemaBusquedaEntrada)) entrada: BusquedaEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<ResultadosBusqueda> {
    return this.busqueda.buscar(entrada.q, usuario);
  }

  @Get('procesos')
  @RequierePermiso('auditoria:ver')
  listarProcesos(@Query(new ValidacionZod(esquemaFiltroEjecuciones)) filtro: FiltroEjecuciones): Promise<ListaEjecuciones> {
    return this.procesos.listar(filtro);
  }
}
