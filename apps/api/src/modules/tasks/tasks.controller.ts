import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  type AvanceEntrada,
  type ComentarioEntrada,
  type EdicionTarea,
  esquemaAvanceEntrada,
  esquemaComentarioEntrada,
  esquemaEdicionTarea,
  esquemaFiltroTareas,
  esquemaTareaEntrada,
  type FiltroTareas,
  MAXIMO_EVIDENCIAS_POR_AVANCE,
  type MiTrabajo,
  type OpcionesTarea,
  type PaginaTareas,
  TAMANO_MAXIMO_EVIDENCIA_MB,
  type TareaDetalle,
  type TareaEntrada,
} from '@sige/types';
import { z } from 'zod';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { Cliente, RequierePermiso, UsuarioActual } from '../../common/auth/decorators';
import { ValidacionZod } from '../../common/validation/zod-validation.pipe';
import { AccesoTareasService } from './task-access.service';
import { AvancesTareaService } from './task-progress.service';
import { GestionTareasService } from './tasks-command.service';
import { ConsultaTareasService } from './tasks-query.service';

const validarId = new ValidacionZod(z.uuid());

@Controller('tareas')
export class TareasController {
  constructor(
    private readonly acceso: AccesoTareasService,
    private readonly consulta: ConsultaTareasService,
    private readonly gestion: GestionTareasService,
    private readonly avances: AvancesTareaService,
  ) {}

  @Get()
  @RequierePermiso('tarea:ver')
  listar(
    @Query(new ValidacionZod(esquemaFiltroTareas)) filtro: FiltroTareas,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<PaginaTareas> {
    return this.consulta.listar(filtro, usuario);
  }

  @Get('opciones')
  @RequierePermiso('tarea:ver')
  opciones(@UsuarioActual() usuario: UsuarioAutenticado): Promise<OpcionesTarea> {
    return this.consulta.opciones(usuario);
  }

  @Get('mi-trabajo')
  @RequierePermiso('tarea:ver')
  miTrabajo(@UsuarioActual() usuario: UsuarioAutenticado): Promise<MiTrabajo> {
    return this.consulta.miTrabajo(usuario);
  }

  @Get(':id')
  @RequierePermiso('tarea:ver')
  async obtener(
    @Param('id', validarId) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<TareaDetalle> {
    await this.acceso.obtenerVisible(usuario, id, cliente);
    return this.consulta.obtener(id, usuario);
  }

  @Post()
  @RequierePermiso('tarea:crear')
  async crear(
    @Body(new ValidacionZod(esquemaTareaEntrada)) datos: TareaEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<TareaDetalle> {
    const id = await this.gestion.crear(datos, usuario, cliente);
    return this.consulta.obtener(id, usuario);
  }

  @Put(':id')
  @RequierePermiso('tarea:crear')
  async editar(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaEdicionTarea)) datos: EdicionTarea,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<TareaDetalle> {
    await this.acceso.obtenerVisible(usuario, id, cliente);
    await this.gestion.editar(id, datos, usuario, cliente);
    return this.consulta.obtener(id, usuario);
  }

  @Post(':id/inicio')
  @HttpCode(200)
  @RequierePermiso('tarea:ver')
  async iniciar(
    @Param('id', validarId) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<TareaDetalle> {
    await this.gestion.iniciar(id, usuario, cliente);
    return this.consulta.obtener(id, usuario);
  }

  @Post(':id/avances')
  @RequierePermiso('tarea:ver')
  @UseInterceptors(
    FilesInterceptor('evidencias', MAXIMO_EVIDENCIAS_POR_AVANCE, {
      limits: { fileSize: TAMANO_MAXIMO_EVIDENCIA_MB * 1024 * 1024, files: MAXIMO_EVIDENCIAS_POR_AVANCE },
    }),
  )
  async registrarAvance(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaAvanceEntrada)) datos: AvanceEntrada,
    @UploadedFiles() archivos: Express.Multer.File[] | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<TareaDetalle> {
    await this.avances.registrar(
      id,
      datos,
      (archivos ?? []).map((archivo) => ({
        nombre: Buffer.from(archivo.originalname, 'latin1').toString('utf8'),
        contenido: archivo.buffer,
      })),
      usuario,
      cliente,
    );
    return this.consulta.obtener(id, usuario);
  }

  @Post(':id/comentarios')
  @RequierePermiso('tarea:ver')
  async comentar(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaComentarioEntrada)) datos: ComentarioEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<TareaDetalle> {
    await this.avances.comentar(id, datos, usuario, cliente);
    return this.consulta.obtener(id, usuario);
  }
}
