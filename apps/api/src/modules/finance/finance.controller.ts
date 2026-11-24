import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  type CatalogoFinanciero,
  type CobroEntrada,
  type ComprobanteEntrada,
  type ContratoEntrada,
  type CuentasPorCobrar,
  type EgresoEntrada,
  type ElementoFinanciero,
  esquemaCatalogoFinanciero,
  esquemaCobroEntrada,
  esquemaComprobanteEntrada,
  esquemaContratoEntrada,
  esquemaEgresoEntrada,
  esquemaFiltroEgresos,
  esquemaFiltroIngresos,
  esquemaFiltroRangoMeses,
  esquemaFormatoExportacion,
  esquemaGeneracionHonorarios,
  esquemaIngresoEntrada,
  esquemaMotivo,
  esquemaNombreSimple,
  esquemaProveedorEntrada,
  esquemaServicioContratadoEntrada,
  esquemaTipoServicio,
  type FichaComercial,
  type FiltroEgresos,
  type FiltroIngresos,
  type FiltroRangoMeses,
  type FlujoCaja,
  type FormatoExportacion,
  type GeneracionHonorarios,
  type HonorariosPorCliente,
  type IndicadoresFinancieros,
  type IngresoDetalle,
  type IngresoEntrada,
  type Motivo,
  type OpcionesFinanzas,
  type PaginaEgresos,
  type PaginaIngresos,
  type Proveedor,
  type ProveedorEntrada,
  type Rentabilidad,
  type ResultadoHonorarios,
  type ServicioContratadoEntrada,
  TAMANO_MAXIMO_ADJUNTO_FINANZAS_MB,
  type TipoServicio,
} from '@sige/types';
import type { Response } from 'express';
import { z } from 'zod';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { Cliente, RequierePermiso, UsuarioActual } from '../../common/auth/decorators';
import { ValidacionZod } from '../../common/validation/zod-validation.pipe';
import { AuditoriaService } from '../audit/audit.service';
import { enviarReporte, momentoDeGeneracion } from '../reports/report-download';
import { FichaComercialService } from './commercial.service';
import { EgresosService } from './expenses.service';
import { GeneracionHonorariosService } from './fee-generation.service';
import type { AdjuntoRecibido } from './finance-attachments';
import { CatalogosFinancierosService } from './finance-catalogs.service';
import { ReportesFinancierosService } from './finance-reports.service';
import { IngresosService } from './income.service';

const validarId = new ValidacionZod(z.uuid());
const validarCatalogo = new ValidacionZod(esquemaCatalogoFinanciero);
const validarFormato = new ValidacionZod(esquemaFormatoExportacion.optional());
const validarRango = new ValidacionZod(esquemaFiltroRangoMeses);
const esquemaActivacion = z.object({ activo: z.boolean() });
const esquemaElementoCatalogo = esquemaNombreSimple.extend({ tipo: esquemaTipoServicio.nullable().default(null) });
const interceptorAdjunto = (campo: string): ReturnType<typeof FilesInterceptor> =>
  FilesInterceptor(campo, 1, { limits: { fileSize: TAMANO_MAXIMO_ADJUNTO_FINANZAS_MB * 1024 * 1024, files: 1 } });

function recibidos(archivos: Express.Multer.File[] | undefined): AdjuntoRecibido[] {
  return (archivos ?? []).map((archivo) => ({
    nombre: Buffer.from(archivo.originalname, 'latin1').toString('utf8'),
    contenido: archivo.buffer,
  }));
}

function detallesRango(filtro: FiltroRangoMeses): Record<string, string | null> {
  return { desde: filtro.desde ?? null, hasta: filtro.hasta ?? null };
}

@Controller()
export class FinanzasController {
  constructor(
    private readonly catalogos: CatalogosFinancierosService,
    private readonly comercial: FichaComercialService,
    private readonly ingresos: IngresosService,
    private readonly egresos: EgresosService,
    private readonly honorarios: GeneracionHonorariosService,
    private readonly reportesFinancieros: ReportesFinancierosService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get('finanzas/opciones')
  @RequierePermiso('comercial:ver')
  opciones(@UsuarioActual() usuario: UsuarioAutenticado): Promise<OpcionesFinanzas> {
    return this.catalogos.opciones(usuario);
  }

  @Get('finanzas/indicadores')
  @RequierePermiso('finanza:ingresos')
  indicadores(): Promise<IndicadoresFinancieros> {
    return this.reportesFinancieros.indicadores();
  }

  @Get('finanzas/catalogos/:catalogo')
  @RequierePermiso('finanza:catalogos')
  listarCatalogo(@Param('catalogo', validarCatalogo) catalogo: CatalogoFinanciero): Promise<ElementoFinanciero[]> {
    return this.catalogos.listar(catalogo);
  }

  @Post('finanzas/catalogos/:catalogo')
  @HttpCode(204)
  @RequierePermiso('finanza:catalogos')
  crearElemento(
    @Param('catalogo', validarCatalogo) catalogo: CatalogoFinanciero,
    @Body(new ValidacionZod(esquemaElementoCatalogo)) datos: { nombre: string; tipo: TipoServicio | null },
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.catalogos.guardar(catalogo, null, datos.nombre, datos.tipo, usuario, cliente);
  }

  @Put('finanzas/catalogos/:catalogo/:id')
  @HttpCode(204)
  @RequierePermiso('finanza:catalogos')
  editarElemento(
    @Param('catalogo', validarCatalogo) catalogo: CatalogoFinanciero,
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaElementoCatalogo)) datos: { nombre: string; tipo: TipoServicio | null },
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.catalogos.guardar(catalogo, id, datos.nombre, datos.tipo, usuario, cliente);
  }

  @Post('finanzas/catalogos/:catalogo/:id/activacion')
  @HttpCode(204)
  @RequierePermiso('finanza:catalogos')
  activarElemento(
    @Param('catalogo', validarCatalogo) catalogo: CatalogoFinanciero,
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaActivacion)) datos: { activo: boolean },
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.catalogos.cambiarActivo(catalogo, id, datos.activo, usuario, cliente);
  }

  @Get('finanzas/proveedores')
  @RequierePermiso('finanza:egresos')
  listarProveedores(): Promise<Proveedor[]> {
    return this.catalogos.listarProveedores();
  }

  @Post('finanzas/proveedores')
  @HttpCode(204)
  @RequierePermiso('finanza:egresos')
  crearProveedor(
    @Body(new ValidacionZod(esquemaProveedorEntrada)) datos: ProveedorEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.catalogos.guardarProveedor(null, datos, usuario, cliente);
  }

  @Put('finanzas/proveedores/:id')
  @HttpCode(204)
  @RequierePermiso('finanza:egresos')
  editarProveedor(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaProveedorEntrada)) datos: ProveedorEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.catalogos.guardarProveedor(id, datos, usuario, cliente);
  }

  @Post('finanzas/proveedores/:id/activacion')
  @HttpCode(204)
  @RequierePermiso('finanza:egresos')
  activarProveedor(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaActivacion)) datos: { activo: boolean },
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.catalogos.cambiarActivoProveedor(id, datos.activo, usuario, cliente);
  }

  @Get('clientes/:clienteId/ficha-comercial')
  @RequierePermiso('comercial:ver')
  fichaComercial(
    @Param('clienteId', validarId) clienteId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<FichaComercial> {
    return this.comercial.ficha(clienteId, usuario);
  }

  @Put('clientes/:clienteId/contrato')
  @HttpCode(204)
  @RequierePermiso('comercial:gestionar')
  guardarContrato(
    @Param('clienteId', validarId) clienteId: string,
    @Body(new ValidacionZod(esquemaContratoEntrada)) datos: ContratoEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.comercial.guardarContrato(clienteId, datos, usuario, cliente);
  }

  @Post('clientes/:clienteId/servicios')
  @HttpCode(204)
  @RequierePermiso('comercial:gestionar')
  contratarServicio(
    @Param('clienteId', validarId) clienteId: string,
    @Body(new ValidacionZod(esquemaServicioContratadoEntrada)) datos: ServicioContratadoEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.comercial.guardarServicio(clienteId, null, datos, usuario, cliente);
  }

  @Put('clientes/:clienteId/servicios/:servicioId')
  @HttpCode(204)
  @RequierePermiso('comercial:gestionar')
  editarServicio(
    @Param('clienteId', validarId) clienteId: string,
    @Param('servicioId', validarId) servicioId: string,
    @Body(new ValidacionZod(esquemaServicioContratadoEntrada)) datos: ServicioContratadoEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.comercial.guardarServicio(clienteId, servicioId, datos, usuario, cliente);
  }

  @Post('clientes/:clienteId/servicios/:servicioId/baja')
  @HttpCode(204)
  @RequierePermiso('comercial:gestionar')
  darDeBajaServicio(
    @Param('clienteId', validarId) clienteId: string,
    @Param('servicioId', validarId) servicioId: string,
    @Body(new ValidacionZod(esquemaMotivo)) datos: Motivo,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.comercial.desactivarServicio(clienteId, servicioId, datos.motivo, usuario, cliente);
  }

  @Get('finanzas/ingresos')
  @RequierePermiso('comercial:ver')
  listarIngresos(@Query(new ValidacionZod(esquemaFiltroIngresos)) filtro: FiltroIngresos): Promise<PaginaIngresos> {
    return this.ingresos.listar(filtro);
  }

  @Post('finanzas/ingresos')
  @RequierePermiso('finanza:ingresos')
  async crearIngreso(
    @Body(new ValidacionZod(esquemaIngresoEntrada)) datos: IngresoEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<IngresoDetalle> {
    const id = await this.ingresos.crear(datos, usuario, cliente);
    return this.ingresos.detalle(id, usuario);
  }

  @Post('finanzas/ingresos/generacion')
  @HttpCode(200)
  @RequierePermiso('finanza:ingresos')
  generarHonorarios(
    @Body(new ValidacionZod(esquemaGeneracionHonorarios)) datos: GeneracionHonorarios,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<ResultadoHonorarios> {
    return this.honorarios.generarManual(datos.periodo, usuario, cliente);
  }

  @Get('finanzas/ingresos/:id')
  @RequierePermiso('comercial:ver')
  detalleIngreso(@Param('id', validarId) id: string, @UsuarioActual() usuario: UsuarioAutenticado): Promise<IngresoDetalle> {
    return this.ingresos.detalle(id, usuario);
  }

  @Put('finanzas/ingresos/:id/comprobante')
  @HttpCode(204)
  @RequierePermiso('finanza:ingresos')
  registrarComprobante(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaComprobanteEntrada)) datos: ComprobanteEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.ingresos.registrarComprobante(id, datos, usuario, cliente);
  }

  @Post('finanzas/ingresos/:id/cobros')
  @HttpCode(204)
  @RequierePermiso('finanza:ingresos')
  @UseInterceptors(interceptorAdjunto('voucher'))
  registrarCobro(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaCobroEntrada)) datos: CobroEntrada,
    @UploadedFiles() archivos: Express.Multer.File[] | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.ingresos.registrarCobro(id, datos, recibidos(archivos), usuario, cliente);
  }

  @Post('finanzas/ingresos/:id/anulacion')
  @HttpCode(204)
  @RequierePermiso('finanza:anular')
  anularIngreso(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaMotivo)) datos: Motivo,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.ingresos.anular(id, datos.motivo, usuario, cliente);
  }

  @Post('finanzas/ingresos/:id/cobros/:cobroId/anulacion')
  @HttpCode(204)
  @RequierePermiso('finanza:anular')
  anularCobro(
    @Param('id', validarId) id: string,
    @Param('cobroId', validarId) cobroId: string,
    @Body(new ValidacionZod(esquemaMotivo)) datos: Motivo,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.ingresos.anularCobro(id, cobroId, datos.motivo, usuario, cliente);
  }

  @Get('finanzas/egresos')
  @RequierePermiso('finanza:egresos')
  listarEgresos(@Query(new ValidacionZod(esquemaFiltroEgresos)) filtro: FiltroEgresos): Promise<PaginaEgresos> {
    return this.egresos.listar(filtro);
  }

  @Post('finanzas/egresos')
  @HttpCode(204)
  @RequierePermiso('finanza:egresos')
  @UseInterceptors(interceptorAdjunto('comprobante'))
  async crearEgreso(
    @Body(new ValidacionZod(esquemaEgresoEntrada)) datos: EgresoEntrada,
    @UploadedFiles() archivos: Express.Multer.File[] | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    await this.egresos.crear(datos, recibidos(archivos), usuario, cliente);
  }

  @Post('finanzas/egresos/:id/anulacion')
  @HttpCode(204)
  @RequierePermiso('finanza:anular')
  anularEgreso(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaMotivo)) datos: Motivo,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.egresos.anular(id, datos.motivo, usuario, cliente);
  }

  @Get('reportes/cuentas-por-cobrar')
  @RequierePermiso('finanza:ingresos')
  async cuentasPorCobrar(
    @Query('formato', validarFormato) formato: FormatoExportacion | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<CuentasPorCobrar | undefined> {
    const reporte = await this.reportesFinancieros.cuentasPorCobrar();

    if (formato === undefined) {
      return reporte;
    }

    await enviarReporte(
      this.auditoria,
      {
        tabla: this.reportesFinancieros.tablaCuentasPorCobrar(reporte, await this.reportesFinancieros.nombreUsuario(usuario.usuarioId), momentoDeGeneracion()),
        nombre: `cuentas-por-cobrar-${reporte.fecha}`,
        formato,
        detalles: { fecha: reporte.fecha },
      },
      usuario,
      cliente,
      respuesta,
    );
    return undefined;
  }

  @Get('reportes/honorarios')
  @RequierePermiso('finanza:ingresos')
  async honorariosPorCliente(
    @Query(validarRango) filtro: FiltroRangoMeses,
    @Query('formato', validarFormato) formato: FormatoExportacion | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<HonorariosPorCliente | undefined> {
    const reporte = await this.reportesFinancieros.honorariosPorCliente(filtro);

    if (formato === undefined) {
      return reporte;
    }

    await enviarReporte(
      this.auditoria,
      {
        tabla: this.reportesFinancieros.tablaHonorarios(reporte, await this.reportesFinancieros.nombreUsuario(usuario.usuarioId), momentoDeGeneracion()),
        nombre: `honorarios-${reporte.desde}-al-${reporte.hasta}`,
        formato,
        detalles: detallesRango(filtro),
      },
      usuario,
      cliente,
      respuesta,
    );
    return undefined;
  }

  @Get('reportes/flujo-caja')
  @RequierePermiso('finanza:egresos')
  async flujoCaja(
    @Query(validarRango) filtro: FiltroRangoMeses,
    @Query('formato', validarFormato) formato: FormatoExportacion | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<FlujoCaja | undefined> {
    const reporte = await this.reportesFinancieros.flujoCaja(filtro);

    if (formato === undefined) {
      return reporte;
    }

    await enviarReporte(
      this.auditoria,
      {
        tabla: this.reportesFinancieros.tablaFlujoCaja(reporte, await this.reportesFinancieros.nombreUsuario(usuario.usuarioId), momentoDeGeneracion()),
        nombre: `flujo-caja-${reporte.desde}-al-${reporte.hasta}`,
        formato,
        detalles: detallesRango(filtro),
      },
      usuario,
      cliente,
      respuesta,
    );
    return undefined;
  }

  @Get('reportes/rentabilidad')
  @RequierePermiso('finanza:egresos')
  async rentabilidad(
    @Query(validarRango) filtro: FiltroRangoMeses,
    @Query('formato', validarFormato) formato: FormatoExportacion | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<Rentabilidad | undefined> {
    const reporte = await this.reportesFinancieros.rentabilidad(filtro);

    if (formato === undefined) {
      return reporte;
    }

    await enviarReporte(
      this.auditoria,
      {
        tabla: this.reportesFinancieros.tablaRentabilidad(reporte, await this.reportesFinancieros.nombreUsuario(usuario.usuarioId), momentoDeGeneracion()),
        nombre: `rentabilidad-${reporte.desde}-al-${reporte.hasta}`,
        formato,
        detalles: detallesRango(filtro),
      },
      usuario,
      cliente,
      respuesta,
    );
    return undefined;
  }
}
