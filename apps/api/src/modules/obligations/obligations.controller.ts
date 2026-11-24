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
  type ControlMensual,
  type CronogramaEntrada,
  esquemaCronogramaEntrada,
  esquemaFiltroCronograma,
  esquemaFiltroObligaciones,
  esquemaGeneracionEntrada,
  esquemaGrupoClienteEntrada,
  esquemaMotivo,
  esquemaObligacionClienteEntrada,
  esquemaPeriodo,
  esquemaPresentacionEntrada,
  esquemaRectificacionEntrada,
  esquemaTipoObligacionEntrada,
  type FichaTributaria,
  type FiltroCronograma,
  type FiltroObligaciones,
  type GeneracionEntrada,
  type GrupoClienteEntrada,
  type HistorialTributario,
  type IndicadoresTributarios,
  type ListaCronograma,
  type ListaObligaciones,
  type Motivo,
  type ObligacionClienteEntrada,
  type ObligacionDetalle,
  type OpcionesObligaciones,
  type PresentacionEntrada,
  type RectificacionEntrada,
  type ResultadoGeneracion,
  TAMANO_MAXIMO_CONSTANCIA_MB,
  type TipoObligacion,
  type TipoObligacionEntrada,
} from '@sige/types';
import { z } from 'zod';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { Cliente, RequierePermiso, UsuarioActual } from '../../common/auth/decorators';
import { fechaHoyEnLima } from '../../common/dates';
import { ValidacionZod } from '../../common/validation/zod-validation.pipe';
import { actorDesde } from '../audit/audit.service';
import { ObligacionesClienteService } from './client-obligations.service';
import { PresentacionObligacionesService } from './obligation-filing.service';
import { GeneracionObligacionesService } from './obligation-generation.service';
import { periodoAGenerar } from './obligation-rules';
import { TiposObligacionService } from './obligation-types.service';
import { ConsultaObligacionesService } from './obligations-query.service';
import { CronogramaService } from './schedule.service';

const validarId = new ValidacionZod(z.uuid());
const esquemaActivacion = z.object({ activo: z.boolean() });
const esquemaFiltroControl = z.object({ periodo: esquemaPeriodo.optional() });

@Controller('obligaciones')
export class ObligacionesController {
  constructor(
    private readonly tipos: TiposObligacionService,
    private readonly cronograma: CronogramaService,
    private readonly delCliente: ObligacionesClienteService,
    private readonly generacion: GeneracionObligacionesService,
    private readonly consulta: ConsultaObligacionesService,
    private readonly presentacion: PresentacionObligacionesService,
  ) {}

  @Get('tipos')
  @RequierePermiso('obligacion:ver')
  listarTipos(): Promise<TipoObligacion[]> {
    return this.tipos.listar();
  }

  @Post('tipos')
  @HttpCode(204)
  @RequierePermiso('cronograma:gestionar')
  crearTipo(
    @Body(new ValidacionZod(esquemaTipoObligacionEntrada)) datos: TipoObligacionEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.tipos.crear(datos, usuario, cliente);
  }

  @Put('tipos/:id')
  @HttpCode(204)
  @RequierePermiso('cronograma:gestionar')
  editarTipo(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaTipoObligacionEntrada)) datos: TipoObligacionEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.tipos.editar(id, datos, usuario, cliente);
  }

  @Post('tipos/:id/activacion')
  @HttpCode(204)
  @RequierePermiso('cronograma:gestionar')
  activarTipo(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaActivacion)) datos: { activo: boolean },
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.tipos.cambiarActivo(id, datos.activo, usuario, cliente);
  }

  @Get('cronograma')
  @RequierePermiso('obligacion:ver')
  listarCronograma(@Query(new ValidacionZod(esquemaFiltroCronograma)) filtro: FiltroCronograma): Promise<ListaCronograma> {
    return this.cronograma.listar(filtro.anio);
  }

  @Put('cronograma')
  @RequierePermiso('cronograma:gestionar')
  async guardarCronograma(
    @Body(new ValidacionZod(esquemaCronogramaEntrada)) datos: CronogramaEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<{ reprogramadas: number }> {
    return { reprogramadas: await this.cronograma.guardar(datos, usuario, cliente) };
  }

  @Get('clientes/:clienteId')
  @RequierePermiso('obligacion:ver')
  fichaTributaria(
    @Param('clienteId', validarId) clienteId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<FichaTributaria> {
    return this.delCliente.ficha(clienteId, usuario, cliente);
  }

  @Get('clientes/:clienteId/historial')
  @RequierePermiso('obligacion:ver')
  historialTributario(
    @Param('clienteId', validarId) clienteId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<HistorialTributario> {
    return this.consulta.historial(clienteId, usuario, cliente);
  }

  @Put('clientes/:clienteId/grupo')
  @HttpCode(204)
  @RequierePermiso('obligacion:gestionar')
  cambiarGrupo(
    @Param('clienteId', validarId) clienteId: string,
    @Body(new ValidacionZod(esquemaGrupoClienteEntrada)) datos: GrupoClienteEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.delCliente.cambiarGrupo(clienteId, datos, usuario, cliente);
  }

  @Post('clientes/:clienteId')
  @HttpCode(204)
  @RequierePermiso('obligacion:gestionar')
  configurar(
    @Param('clienteId', validarId) clienteId: string,
    @Body(new ValidacionZod(esquemaObligacionClienteEntrada)) datos: ObligacionClienteEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.delCliente.agregar(clienteId, datos, usuario, cliente);
  }

  @Put('clientes/:clienteId/:obligacionId')
  @HttpCode(204)
  @RequierePermiso('obligacion:gestionar')
  editarConfiguracion(
    @Param('clienteId', validarId) clienteId: string,
    @Param('obligacionId', validarId) obligacionId: string,
    @Body(new ValidacionZod(esquemaObligacionClienteEntrada)) datos: ObligacionClienteEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.delCliente.editar(clienteId, obligacionId, datos, usuario, cliente);
  }

  @Post('clientes/:clienteId/:obligacionId/desactivacion')
  @HttpCode(204)
  @RequierePermiso('obligacion:gestionar')
  desactivarConfiguracion(
    @Param('clienteId', validarId) clienteId: string,
    @Param('obligacionId', validarId) obligacionId: string,
    @Body(new ValidacionZod(esquemaMotivo)) datos: Motivo,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.delCliente.desactivar(clienteId, obligacionId, datos.motivo, usuario, cliente);
  }

  @Get()
  @RequierePermiso('obligacion:ver')
  listar(
    @Query(new ValidacionZod(esquemaFiltroObligaciones)) filtro: FiltroObligaciones,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<ListaObligaciones> {
    return this.consulta.listar(filtro, usuario);
  }

  @Get('opciones')
  @RequierePermiso('obligacion:ver')
  opciones(@UsuarioActual() usuario: UsuarioAutenticado): Promise<OpcionesObligaciones> {
    return this.consulta.opciones(usuario);
  }

  @Get('control')
  @RequierePermiso('obligacion:ver')
  control(
    @Query(new ValidacionZod(esquemaFiltroControl)) filtro: { periodo?: string | undefined },
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<ControlMensual> {
    return this.consulta.control(filtro.periodo ?? periodoAGenerar(fechaHoyEnLima()), usuario);
  }

  @Get('indicadores')
  @RequierePermiso('obligacion:ver')
  indicadores(@UsuarioActual() usuario: UsuarioAutenticado): Promise<IndicadoresTributarios> {
    return this.consulta.indicadores(usuario);
  }

  @Post('generacion')
  @RequierePermiso('obligacion:gestionar')
  generar(
    @Body(new ValidacionZod(esquemaGeneracionEntrada)) datos: GeneracionEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<ResultadoGeneracion> {
    return this.generacion.generar(datos.periodo, actorDesde(usuario, cliente));
  }

  @Get(':id')
  @RequierePermiso('obligacion:ver')
  detalle(
    @Param('id', validarId) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<ObligacionDetalle> {
    return this.consulta.detalle(id, usuario, cliente);
  }

  @Post(':id/presentacion')
  @RequierePermiso('obligacion:ver')
  @UseInterceptors(
    FilesInterceptor('constancia', 1, {
      limits: { fileSize: TAMANO_MAXIMO_CONSTANCIA_MB * 1024 * 1024, files: 1 },
    }),
  )
  async presentar(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaPresentacionEntrada)) datos: PresentacionEntrada,
    @UploadedFiles() archivos: Express.Multer.File[] | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<ObligacionDetalle> {
    await this.presentacion.presentar(
      id,
      datos,
      (archivos ?? []).map((archivo) => ({
        nombre: Buffer.from(archivo.originalname, 'latin1').toString('utf8'),
        contenido: archivo.buffer,
      })),
      usuario,
      cliente,
    );
    return this.consulta.detalle(id, usuario, cliente);
  }

  @Post(':id/rectificaciones')
  @RequierePermiso('obligacion:ver')
  @UseInterceptors(
    FilesInterceptor('constancia', 1, {
      limits: { fileSize: TAMANO_MAXIMO_CONSTANCIA_MB * 1024 * 1024, files: 1 },
    }),
  )
  async rectificar(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaRectificacionEntrada)) datos: RectificacionEntrada,
    @UploadedFiles() archivos: Express.Multer.File[] | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<ObligacionDetalle> {
    await this.presentacion.rectificar(
      id,
      datos,
      (archivos ?? []).map((archivo) => ({
        nombre: Buffer.from(archivo.originalname, 'latin1').toString('utf8'),
        contenido: archivo.buffer,
      })),
      usuario,
      cliente,
    );
    return this.consulta.detalle(id, usuario, cliente);
  }
}
