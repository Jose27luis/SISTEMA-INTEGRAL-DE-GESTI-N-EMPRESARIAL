import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  type CambioEstadoProyecto,
  type DificultadEntrada,
  type EntregableEntrada,
  esquemaCambioEstadoProyecto,
  esquemaDificultadEntrada,
  esquemaEntregableEntrada,
  esquemaEtapaEntrada,
  esquemaFiltroProyectos,
  esquemaOrdenEtapa,
  esquemaProyectoEntrada,
  esquemaRevisionEntregable,
  type EtapaEntrada,
  type FiltroProyectos,
  type IndicadoresProyectos,
  type OpcionesProyecto,
  type OrdenEtapa,
  type PaginaProyectos,
  type ProyectoDetalle,
  type ProyectoEntrada,
  type RevisionEntregable,
  TAMANO_MAXIMO_ENTREGABLE_MB,
} from '@sige/types';
import { z } from 'zod';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { Cliente, RequierePermiso, UsuarioActual } from '../../common/auth/decorators';
import { ValidacionZod } from '../../common/validation/zod-validation.pipe';
import { type ArchivoRecibido, EtapasProyectoService } from './project-stages.service';
import { GestionProyectosService } from './projects-command.service';
import { ConsultaProyectosService } from './projects-query.service';

const validarId = new ValidacionZod(z.uuid());
const interceptorArchivo = FilesInterceptor('archivo', 1, {
  limits: { fileSize: TAMANO_MAXIMO_ENTREGABLE_MB * 1024 * 1024, files: 1 },
});

function recibidos(archivos: Express.Multer.File[] | undefined): ArchivoRecibido[] {
  return (archivos ?? []).map((archivo) => ({
    nombre: Buffer.from(archivo.originalname, 'latin1').toString('utf8'),
    contenido: archivo.buffer,
  }));
}

@Controller('proyectos')
export class ProyectosController {
  constructor(
    private readonly consulta: ConsultaProyectosService,
    private readonly gestion: GestionProyectosService,
    private readonly etapas: EtapasProyectoService,
  ) {}

  @Get()
  @RequierePermiso('proyecto:ver')
  listar(
    @Query(new ValidacionZod(esquemaFiltroProyectos)) filtro: FiltroProyectos,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<PaginaProyectos> {
    return this.consulta.listar(filtro, usuario);
  }

  @Get('opciones')
  @RequierePermiso('proyecto:ver')
  opciones(@UsuarioActual() usuario: UsuarioAutenticado): Promise<OpcionesProyecto> {
    return this.consulta.opciones(usuario);
  }

  @Get('indicadores')
  @RequierePermiso('proyecto:ver')
  indicadores(@UsuarioActual() usuario: UsuarioAutenticado): Promise<IndicadoresProyectos> {
    return this.consulta.indicadores(usuario);
  }

  @Post()
  @RequierePermiso('proyecto:crear')
  async crear(
    @Body(new ValidacionZod(esquemaProyectoEntrada)) datos: ProyectoEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<ProyectoDetalle> {
    const id = await this.gestion.crear(datos, usuario, cliente);
    return this.consulta.detalle(id, usuario, cliente);
  }

  @Get(':id')
  @RequierePermiso('proyecto:ver')
  detalle(
    @Param('id', validarId) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<ProyectoDetalle> {
    return this.consulta.detalle(id, usuario, cliente);
  }

  @Put(':id')
  @HttpCode(204)
  @RequierePermiso('proyecto:ver')
  editar(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaProyectoEntrada)) datos: ProyectoEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.gestion.editar(id, datos, usuario, cliente);
  }

  @Post(':id/estado')
  @HttpCode(204)
  @RequierePermiso('proyecto:ver')
  cambiarEstado(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaCambioEstadoProyecto)) datos: CambioEstadoProyecto,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.gestion.cambiarEstado(id, datos, usuario, cliente);
  }

  @Post(':id/dificultad')
  @HttpCode(204)
  @RequierePermiso('proyecto:ver')
  marcarDificultad(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaDificultadEntrada)) datos: DificultadEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.gestion.marcarDificultad(id, datos, usuario, cliente);
  }

  @Post(':id/etapas')
  @HttpCode(204)
  @RequierePermiso('proyecto:ver')
  crearEtapa(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaEtapaEntrada)) datos: EtapaEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.etapas.guardarEtapa(id, null, datos, usuario, cliente);
  }

  @Put(':id/etapas/:etapaId')
  @HttpCode(204)
  @RequierePermiso('proyecto:ver')
  editarEtapa(
    @Param('id', validarId) id: string,
    @Param('etapaId', validarId) etapaId: string,
    @Body(new ValidacionZod(esquemaEtapaEntrada)) datos: EtapaEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.etapas.guardarEtapa(id, etapaId, datos, usuario, cliente);
  }

  @Post(':id/etapas/:etapaId/orden')
  @HttpCode(204)
  @RequierePermiso('proyecto:ver')
  ordenarEtapa(
    @Param('id', validarId) id: string,
    @Param('etapaId', validarId) etapaId: string,
    @Body(new ValidacionZod(esquemaOrdenEtapa)) datos: OrdenEtapa,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.etapas.ordenarEtapa(id, etapaId, datos, usuario, cliente);
  }

  @Post(':id/etapas/:etapaId/entregables')
  @HttpCode(204)
  @RequierePermiso('proyecto:ver')
  crearEntregable(
    @Param('id', validarId) id: string,
    @Param('etapaId', validarId) etapaId: string,
    @Body(new ValidacionZod(esquemaEntregableEntrada)) datos: EntregableEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.etapas.crearEntregable(id, etapaId, datos, usuario, cliente);
  }

  @Post(':id/entregables/:entregableId/entrega')
  @HttpCode(204)
  @RequierePermiso('proyecto:ver')
  @UseInterceptors(interceptorArchivo)
  entregar(
    @Param('id', validarId) id: string,
    @Param('entregableId', validarId) entregableId: string,
    @UploadedFiles() archivos: Express.Multer.File[] | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.etapas.entregar(id, entregableId, recibidos(archivos), usuario, cliente);
  }

  @Post(':id/entregables/:entregableId/revision')
  @HttpCode(204)
  @RequierePermiso('proyecto:ver')
  revisar(
    @Param('id', validarId) id: string,
    @Param('entregableId', validarId) entregableId: string,
    @Body(new ValidacionZod(esquemaRevisionEntregable)) datos: RevisionEntregable,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.etapas.revisar(id, entregableId, datos, usuario, cliente);
  }
}
