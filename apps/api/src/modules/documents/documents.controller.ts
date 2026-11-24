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
  type CarpetaEntrada,
  type DocumentoDetalle,
  type DocumentoEntrada,
  type DocumentoEsperadoEntrada,
  type EdicionDocumento,
  esquemaCarpetaEntrada,
  esquemaDocumentoEntrada,
  esquemaDocumentoEsperadoEntrada,
  esquemaEdicionDocumento,
  esquemaFiltroDocumentos,
  esquemaMotivo,
  esquemaTipoDocumentoEntrada,
  esquemaVersionEntrada,
  type ExpedienteDocumental,
  type FiltroDocumentos,
  type IndicadoresDocumentales,
  type Motivo,
  type OpcionesDocumentos,
  type PaginaDocumentos,
  TAMANO_MAXIMO_DOCUMENTO_MB,
  type TipoDocumento,
  type TipoDocumentoEntrada,
  type VersionEntrada,
} from '@sige/types';
import { z } from 'zod';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { Cliente, RequierePermiso, UsuarioActual } from '../../common/auth/decorators';
import { ValidacionZod } from '../../common/validation/zod-validation.pipe';
import { TiposDocumentoService } from './document-types.service';
import { GestionDocumentosService } from './documents-command.service';
import { ConsultaDocumentosService } from './documents-query.service';
import { DocumentosEsperadosService } from './expected-documents.service';
import { CarpetasService } from './folders.service';

const validarId = new ValidacionZod(z.uuid());
const esquemaActivacion = z.object({ activo: z.boolean() });
const esquemaNombreCarpeta = esquemaCarpetaEntrada.pick({ nombre: true });
const interceptorArchivo = FilesInterceptor('archivo', 1, {
  limits: { fileSize: TAMANO_MAXIMO_DOCUMENTO_MB * 1024 * 1024, files: 1 },
});

function recibidos(archivos: Express.Multer.File[] | undefined): { nombre: string; contenido: Buffer }[] {
  return (archivos ?? []).map((archivo) => ({
    nombre: Buffer.from(archivo.originalname, 'latin1').toString('utf8'),
    contenido: archivo.buffer,
  }));
}

@Controller('documentos')
export class DocumentosController {
  constructor(
    private readonly tipos: TiposDocumentoService,
    private readonly carpetas: CarpetasService,
    private readonly esperados: DocumentosEsperadosService,
    private readonly gestion: GestionDocumentosService,
    private readonly consulta: ConsultaDocumentosService,
  ) {}

  @Get('tipos')
  @RequierePermiso('documento:ver')
  listarTipos(): Promise<TipoDocumento[]> {
    return this.tipos.listar();
  }

  @Post('tipos')
  @HttpCode(204)
  @RequierePermiso('catalogo:gestionar')
  crearTipo(
    @Body(new ValidacionZod(esquemaTipoDocumentoEntrada)) datos: TipoDocumentoEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.tipos.guardar(null, datos, usuario, cliente);
  }

  @Put('tipos/:id')
  @HttpCode(204)
  @RequierePermiso('catalogo:gestionar')
  editarTipo(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaTipoDocumentoEntrada)) datos: TipoDocumentoEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.tipos.guardar(id, datos, usuario, cliente);
  }

  @Post('tipos/:id/activacion')
  @HttpCode(204)
  @RequierePermiso('catalogo:gestionar')
  activarTipo(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaActivacion)) datos: { activo: boolean },
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.tipos.cambiarActivo(id, datos.activo, usuario, cliente);
  }

  @Get('opciones')
  @RequierePermiso('documento:ver')
  opciones(@UsuarioActual() usuario: UsuarioAutenticado): Promise<OpcionesDocumentos> {
    return this.consulta.opciones(usuario);
  }

  @Get('indicadores')
  @RequierePermiso('documento:ver')
  indicadores(@UsuarioActual() usuario: UsuarioAutenticado): Promise<IndicadoresDocumentales> {
    return this.consulta.indicadores(usuario);
  }

  @Get('clientes/:clienteId')
  @RequierePermiso('documento:ver')
  expediente(
    @Param('clienteId', validarId) clienteId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<ExpedienteDocumental> {
    return this.consulta.expediente(clienteId, usuario, cliente);
  }

  @Post('clientes/:clienteId/carpetas')
  @HttpCode(204)
  @RequierePermiso('documento:gestionar')
  crearCarpeta(
    @Param('clienteId', validarId) clienteId: string,
    @Body(new ValidacionZod(esquemaCarpetaEntrada)) datos: CarpetaEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.carpetas.crear(clienteId, datos, usuario, cliente);
  }

  @Put('clientes/:clienteId/carpetas/:carpetaId')
  @HttpCode(204)
  @RequierePermiso('documento:gestionar')
  renombrarCarpeta(
    @Param('clienteId', validarId) clienteId: string,
    @Param('carpetaId', validarId) carpetaId: string,
    @Body(new ValidacionZod(esquemaNombreCarpeta)) datos: { nombre: string },
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.carpetas.renombrar(clienteId, carpetaId, datos.nombre, usuario, cliente);
  }

  @Post('clientes/:clienteId/esperados')
  @HttpCode(204)
  @RequierePermiso('documento:gestionar')
  crearEsperado(
    @Param('clienteId', validarId) clienteId: string,
    @Body(new ValidacionZod(esquemaDocumentoEsperadoEntrada)) datos: DocumentoEsperadoEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.esperados.crear(clienteId, datos, usuario, cliente);
  }

  @Post('clientes/:clienteId/esperados/:esperadoId/anulacion')
  @HttpCode(204)
  @RequierePermiso('documento:gestionar')
  anularEsperado(
    @Param('clienteId', validarId) clienteId: string,
    @Param('esperadoId', validarId) esperadoId: string,
    @Body(new ValidacionZod(esquemaMotivo)) datos: Motivo,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.esperados.anular(clienteId, esperadoId, datos.motivo, usuario, cliente);
  }

  @Get()
  @RequierePermiso('documento:ver')
  listar(
    @Query(new ValidacionZod(esquemaFiltroDocumentos)) filtro: FiltroDocumentos,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<PaginaDocumentos> {
    return this.consulta.listar(filtro, usuario);
  }

  @Post()
  @RequierePermiso('documento:gestionar')
  @UseInterceptors(interceptorArchivo)
  async subir(
    @Body(new ValidacionZod(esquemaDocumentoEntrada)) datos: DocumentoEntrada,
    @UploadedFiles() archivos: Express.Multer.File[] | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<DocumentoDetalle> {
    const id = await this.gestion.subir(datos, recibidos(archivos), usuario, cliente);
    return this.consulta.detalle(id, usuario, cliente);
  }

  @Get(':id')
  @RequierePermiso('documento:ver')
  detalle(
    @Param('id', validarId) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<DocumentoDetalle> {
    return this.consulta.detalle(id, usuario, cliente);
  }

  @Put(':id')
  @RequierePermiso('documento:gestionar')
  async editar(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaEdicionDocumento)) datos: EdicionDocumento,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<DocumentoDetalle> {
    await this.gestion.editar(id, datos, usuario, cliente);
    return this.consulta.detalle(id, usuario, cliente);
  }

  @Post(':id/versiones')
  @RequierePermiso('documento:gestionar')
  @UseInterceptors(interceptorArchivo)
  async nuevaVersion(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaVersionEntrada)) datos: VersionEntrada,
    @UploadedFiles() archivos: Express.Multer.File[] | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<DocumentoDetalle> {
    await this.gestion.nuevaVersion(id, datos.nota, recibidos(archivos), usuario, cliente);
    return this.consulta.detalle(id, usuario, cliente);
  }

  @Post(':id/archivo')
  @HttpCode(204)
  @RequierePermiso('documento:gestionar')
  archivar(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaMotivo)) datos: Motivo,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.gestion.archivar(id, datos.motivo, usuario, cliente);
  }
}
