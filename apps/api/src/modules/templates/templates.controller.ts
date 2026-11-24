import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import {
  esquemaPlantillaEntrada,
  esquemaReglaEntrada,
  type Plantilla,
  type PlantillaEntrada,
  type Regla,
  type ReglaEntrada,
} from '@sige/types';
import { z } from 'zod';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { Cliente, RequierePermiso, UsuarioActual } from '../../common/auth/decorators';
import { ValidacionZod } from '../../common/validation/zod-validation.pipe';
import { RecurrenciaService } from './recurrence.service';
import { PlantillasService } from './templates.service';

const validarId = new ValidacionZod(z.uuid());
const esquemaActivacion = z.object({ activo: z.boolean() });
const esquemaFiltroPlantillas = z.object({ todas: z.enum(['si']).optional() });

@Controller()
export class PlantillasController {
  constructor(
    private readonly plantillas: PlantillasService,
    private readonly recurrencia: RecurrenciaService,
  ) {}

  @Get('plantillas')
  @RequierePermiso('tarea:ver')
  listarPlantillas(@Query(new ValidacionZod(esquemaFiltroPlantillas)) filtro: { todas?: 'si' | undefined }): Promise<Plantilla[]> {
    return this.plantillas.listar(filtro.todas !== 'si');
  }

  @Post('plantillas')
  @HttpCode(204)
  @RequierePermiso('plantilla:gestionar')
  crearPlantilla(
    @Body(new ValidacionZod(esquemaPlantillaEntrada)) datos: PlantillaEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.plantillas.guardar(null, datos, usuario, cliente);
  }

  @Put('plantillas/:id')
  @HttpCode(204)
  @RequierePermiso('plantilla:gestionar')
  editarPlantilla(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaPlantillaEntrada)) datos: PlantillaEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.plantillas.guardar(id, datos, usuario, cliente);
  }

  @Post('plantillas/:id/activacion')
  @HttpCode(204)
  @RequierePermiso('plantilla:gestionar')
  activarPlantilla(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaActivacion)) datos: { activo: boolean },
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.plantillas.cambiarActivo(id, datos.activo, usuario, cliente);
  }

  @Get('tareas-recurrentes')
  @RequierePermiso('plantilla:gestionar')
  listarReglas(@UsuarioActual() usuario: UsuarioAutenticado): Promise<Regla[]> {
    return this.recurrencia.listar(usuario);
  }

  @Post('tareas-recurrentes')
  @HttpCode(204)
  @RequierePermiso('plantilla:gestionar')
  crearRegla(
    @Body(new ValidacionZod(esquemaReglaEntrada)) datos: ReglaEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.recurrencia.crear(datos, usuario, cliente);
  }

  @Post('tareas-recurrentes/:id/activacion')
  @HttpCode(204)
  @RequierePermiso('plantilla:gestionar')
  activarRegla(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaActivacion)) datos: { activo: boolean },
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.recurrencia.cambiarActivo(id, datos.activo, usuario, cliente);
  }
}
