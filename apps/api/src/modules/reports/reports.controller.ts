import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import {
  esquemaFiltroPeriodo,
  esquemaFormatoExportacion,
  esquemaPeriodo,
  type FiltroPeriodo,
  type FormatoExportacion,
  type HistorialTrabajador,
  type ReporteActividades,
  type ReporteClientes,
  type ReportePersonal,
  type Tablero,
} from '@sige/types';
import type { Response } from 'express';
import { z } from 'zod';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { Cliente, RequierePermiso, UsuarioActual } from '../../common/auth/decorators';
import { fechaHoyEnLima, horaEnLima } from '../../common/dates';
import { ValidacionZod } from '../../common/validation/zod-validation.pipe';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
import { ReporteClientesService } from './client-report.service';
import { TableroService } from './dashboard.service';
import { exportarExcel, exportarPdf, type TablaExportable } from './report-exporter';
import { ReportesService } from './reports.service';
import { HistorialTrabajadorService } from './staff-history.service';

const validarFiltro = new ValidacionZod(esquemaFiltroPeriodo);
const validarFormato = new ValidacionZod(esquemaFormatoExportacion.optional());

const validarFiltroClientes = new ValidacionZod(z.object({ periodo: esquemaPeriodo.optional() }));

function detallesDeFiltro(filtro: FiltroPeriodo): Record<string, string | null> {
  return {
    desde: filtro.desde,
    hasta: filtro.hasta,
    areaId: filtro.areaId ?? null,
    usuarioId: filtro.usuarioId ?? null,
  };
}

function periodoAnterior(hoy: string): string {
  const [anio, mes] = hoy.split('-').map(Number);
  return new Date(Date.UTC(anio ?? 2000, (mes ?? 1) - 2, 1)).toISOString().slice(0, 7);
}

const TIPOS_CONTENIDO: Record<FormatoExportacion, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

@Controller()
export class ReportesController {
  constructor(
    private readonly tablero: TableroService,
    private readonly historial: HistorialTrabajadorService,
    private readonly reportes: ReportesService,
    private readonly auditoria: AuditoriaService,
    private readonly reporteClientes: ReporteClientesService,
  ) {}

  @Get('tablero')
  @RequierePermiso('tarea:ver')
  obtenerTablero(
    @Query(validarFiltro) filtro: FiltroPeriodo,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<Tablero> {
    return this.tablero.obtener(usuario, filtro);
  }

  @Get('historial/:usuarioId')
  @RequierePermiso('tarea:ver')
  obtenerHistorial(
    @Param('usuarioId', new ValidacionZod(z.uuid())) usuarioId: string,
    @Query(validarFiltro) filtro: FiltroPeriodo,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<HistorialTrabajador> {
    return this.historial.obtener(usuarioId, { desde: filtro.desde, hasta: filtro.hasta }, usuario, cliente);
  }

  @Get('reportes/personal')
  @RequierePermiso('reporte:personal')
  async personal(
    @Query(validarFiltro) filtro: FiltroPeriodo,
    @Query('formato', validarFormato) formato: FormatoExportacion | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<ReportePersonal | undefined> {
    const reporte = await this.reportes.personal(usuario, filtro);

    if (formato === undefined) {
      return reporte;
    }

    await this.enviarArchivo(
      this.reportes.tablaPersonal(reporte, await this.reportes.nombreUsuario(usuario.usuarioId), this.momento()),
      `reporte-personal-${filtro.desde}-al-${filtro.hasta}`,
      formato,
      detallesDeFiltro(filtro),
      usuario,
      cliente,
      respuesta,
    );
    return undefined;
  }

  @Get('reportes/actividades')
  @RequierePermiso('reporte:personal')
  async actividades(
    @Query(validarFiltro) filtro: FiltroPeriodo,
    @Query('formato', validarFormato) formato: FormatoExportacion | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<ReporteActividades | undefined> {
    const reporte = await this.reportes.actividades(usuario, filtro);

    if (formato === undefined) {
      return reporte;
    }

    await this.enviarArchivo(
      this.reportes.tablaActividades(reporte, await this.reportes.nombreUsuario(usuario.usuarioId), this.momento()),
      `reporte-actividades-${filtro.desde}-al-${filtro.hasta}`,
      formato,
      detallesDeFiltro(filtro),
      usuario,
      cliente,
      respuesta,
    );
    return undefined;
  }

  @Get('reportes/clientes')
  @RequierePermiso('reporte:clientes')
  async clientes(
    @Query(validarFiltroClientes) filtro: { periodo?: string | undefined },
    @Query('formato', validarFormato) formato: FormatoExportacion | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<ReporteClientes | undefined> {
    const periodo = filtro.periodo ?? periodoAnterior(fechaHoyEnLima());
    const reporte = await this.reporteClientes.obtener(usuario, periodo);

    if (formato === undefined) {
      return reporte;
    }

    await this.enviarArchivo(
      this.reporteClientes.tabla(reporte, await this.reportes.nombreUsuario(usuario.usuarioId), this.momento()),
      `reporte-clientes-${periodo}`,
      formato,
      { periodo },
      usuario,
      cliente,
      respuesta,
    );
    return undefined;
  }

  private momento(): string {
    const [anio, mes, dia] = fechaHoyEnLima().split('-');
    return `${dia ?? ''}/${mes ?? ''}/${anio ?? ''} ${horaEnLima(new Date())}`;
  }

  private async enviarArchivo(
    tabla: TablaExportable,
    nombre: string,
    formato: FormatoExportacion,
    detalles: Record<string, string | null>,
    usuario: UsuarioAutenticado,
    cliente: ContextoCliente,
    respuesta: Response,
  ): Promise<void> {
    const contenido = formato === 'xlsx' ? await exportarExcel(tabla) : await exportarPdf(tabla);

    await this.auditoria.registrar({
      actor: actorDesde(usuario, cliente),
      accion: 'DESCARGAR',
      entidad: 'reporte',
      entidadId: null,
      despues: { reporte: tabla.titulo, formato, ...detalles, filas: tabla.filas.length },
    });

    respuesta.setHeader('Content-Type', TIPOS_CONTENIDO[formato]);
    respuesta.setHeader('Content-Disposition', `attachment; filename="${nombre}.${formato}"`);
    respuesta.setHeader('Cache-Control', 'private, no-store');
    respuesta.setHeader('X-Content-Type-Options', 'nosniff');
    respuesta.end(contenido);
  }
}
