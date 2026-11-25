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
  type CancelacionEntrada,
  type ComentarioEntrada,
  type EdicionTarea,
  type EnvioEntrada,
  esquemaAvanceEntrada,
  esquemaCancelacionEntrada,
  esquemaComentarioEntrada,
  esquemaEdicionTarea,
  esquemaEnvioEntrada,
  esquemaFiltroTareas,
  esquemaFinalizacionEntrada,
  esquemaItemEntrada,
  esquemaMarcaItem,
  esquemaProrrogaEntrada,
  esquemaResolucionProrroga,
  esquemaRevisionEntrada,
  esquemaTareaEntrada,
  type ProrrogaEntrada,
  type ResolucionProrroga,
  type FiltroTareas,
  type FinalizacionEntrada,
  type ItemEntrada,
  type MarcaItem,
  MAXIMO_EVIDENCIAS_POR_AVANCE,
  type MiTrabajo,
  type OpcionesTarea,
  type PaginaTareas,
  type RevisionEntrada,
  TAMANO_MAXIMO_EVIDENCIA_MB,
  type TareaDetalle,
  type TareaEntrada,
} from '@sige/types';
import { z } from 'zod';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { Cliente, RequierePermiso, UsuarioActual } from '../../common/auth/decorators';
import { ValidacionZod } from '../../common/validation/zod-validation.pipe';
import { AccesoTareasService } from './task-access.service';
import { ListaVerificacionService } from './task-checklist.service';
import { AvancesTareaService } from './task-progress.service';
import { RevisionTareasService } from './task-review.service';
import { SeguimientoTareasService } from './task-tracking.service';
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
    private readonly revision: RevisionTareasService,
    private readonly lista: ListaVerificacionService,
    private readonly seguimiento: SeguimientoTareasService,
  ) {}

  @Post(':id/acuse')
  @HttpCode(200)
  @RequierePermiso('tarea:ver')
  async acusar(
    @Param('id', validarId) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<TareaDetalle> {
    await this.seguimiento.acusar(id, usuario, cliente);
    return this.consulta.obtener(id, usuario);
  }

  @Post(':id/prorrogas')
  @HttpCode(200)
  @RequierePermiso('tarea:ver')
  async solicitarProrroga(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaProrrogaEntrada)) datos: ProrrogaEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<TareaDetalle> {
    await this.seguimiento.solicitarProrroga(id, datos, usuario, cliente);
    return this.consulta.obtener(id, usuario);
  }

  @Post(':id/prorrogas/:prorrogaId/resolucion')
  @HttpCode(200)
  @RequierePermiso('tarea:ver')
  async resolverProrroga(
    @Param('id', validarId) id: string,
    @Param('prorrogaId', validarId) prorrogaId: string,
    @Body(new ValidacionZod(esquemaResolucionProrroga)) datos: ResolucionProrroga,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<TareaDetalle> {
    await this.seguimiento.resolverProrroga(id, prorrogaId, datos, usuario, cliente);
    return this.consulta.obtener(id, usuario);
  }

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

  @Post(':id/items')
  @RequierePermiso('tarea:ver')
  async agregarItem(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaItemEntrada)) datos: ItemEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<TareaDetalle> {
    await this.lista.agregar(id, datos.texto, usuario, cliente);
    return this.consulta.obtener(id, usuario);
  }

  @Post(':id/items/:itemId')
  @RequierePermiso('tarea:ver')
  async marcarItem(
    @Param('id', validarId) id: string,
    @Param('itemId', validarId) itemId: string,
    @Body(new ValidacionZod(esquemaMarcaItem)) datos: MarcaItem,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<TareaDetalle> {
    await this.lista.marcar(id, itemId, datos.completado, usuario, cliente);
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

  @Post(':id/envio')
  @HttpCode(200)
  @RequierePermiso('tarea:ver')
  async enviar(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaEnvioEntrada)) datos: EnvioEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<TareaDetalle> {
    await this.revision.enviar(id, datos, usuario, cliente);
    return this.consulta.obtener(id, usuario);
  }

  @Post(':id/revision')
  @HttpCode(200)
  @RequierePermiso('tarea:revisar')
  async revisar(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaRevisionEntrada)) datos: RevisionEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<TareaDetalle> {
    await this.revision.revisar(id, datos, usuario, cliente);
    return this.consulta.obtener(id, usuario);
  }

  @Post(':id/finalizacion')
  @HttpCode(200)
  @RequierePermiso('tarea:crear')
  async finalizar(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaFinalizacionEntrada)) datos: FinalizacionEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<TareaDetalle> {
    await this.revision.finalizar(id, datos, usuario, cliente);
    return this.consulta.obtener(id, usuario);
  }

  @Post(':id/cancelacion')
  @HttpCode(200)
  @RequierePermiso('tarea:crear')
  async cancelar(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaCancelacionEntrada)) datos: CancelacionEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<TareaDetalle> {
    await this.revision.cancelar(id, datos, usuario, cliente);
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
