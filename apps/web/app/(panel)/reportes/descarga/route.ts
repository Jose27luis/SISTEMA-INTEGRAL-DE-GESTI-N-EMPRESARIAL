import { esquemaFiltroPeriodo, esquemaFiltroRangoMeses, esquemaFormatoExportacion, esquemaPeriodo } from '@sige/types';
import { type NextRequest, NextResponse } from 'next/server';
import { descargarDeApi } from '@/lib/api';

const CABECERAS_PERMITIDAS = ['content-type', 'content-disposition', 'cache-control', 'x-content-type-options'];

const FILTRO_NO_VALIDO = new NextResponse('Los filtros del reporte no son válidos.', {
  status: 400,
  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
});

const REPORTES_POR_RANGO = new Set(['honorarios', 'flujo-caja', 'rentabilidad']);

function rutaDelReporte(parametros: URLSearchParams, formato: string): string | null {
  const tipo = parametros.get('tipo');

  if (tipo === 'cuentas-por-cobrar') {
    return `/reportes/cuentas-por-cobrar?${new URLSearchParams({ formato }).toString()}`;
  }

  if (tipo !== null && REPORTES_POR_RANGO.has(tipo)) {
    const rango = esquemaFiltroRangoMeses.safeParse({ desde: parametros.get('desde') ?? '', hasta: parametros.get('hasta') ?? '' });

    if (!rango.success) {
      return null;
    }

    const consulta = new URLSearchParams({ formato });

    if (rango.data.desde !== undefined) {
      consulta.set('desde', rango.data.desde);
    }

    if (rango.data.hasta !== undefined) {
      consulta.set('hasta', rango.data.hasta);
    }

    return `/reportes/${tipo}?${consulta.toString()}`;
  }

  if (tipo === 'clientes') {
    const periodo = esquemaPeriodo.safeParse(parametros.get('periodo') ?? '');
    return periodo.success ? `/reportes/clientes?${new URLSearchParams({ periodo: periodo.data, formato }).toString()}` : null;
  }

  const filtro = esquemaFiltroPeriodo.safeParse({
    desde: parametros.get('desde') ?? '',
    hasta: parametros.get('hasta') ?? '',
    areaId: parametros.get('areaId') ?? '',
    usuarioId: parametros.get('usuarioId') ?? '',
  });

  if (!filtro.success) {
    return null;
  }

  const consulta = new URLSearchParams({ desde: filtro.data.desde, hasta: filtro.data.hasta, formato });

  if (filtro.data.areaId !== undefined) {
    consulta.set('areaId', filtro.data.areaId);
  }

  if (filtro.data.usuarioId !== undefined) {
    consulta.set('usuarioId', filtro.data.usuarioId);
  }

  return `/reportes/${tipo === 'actividades' ? 'actividades' : 'personal'}?${consulta.toString()}`;
}

export async function GET(solicitud: NextRequest): Promise<NextResponse> {
  const parametros = solicitud.nextUrl.searchParams;
  const formato = esquemaFormatoExportacion.safeParse(parametros.get('formato'));
  const ruta = formato.success ? rutaDelReporte(parametros, formato.data) : null;

  if (ruta === null) {
    return FILTRO_NO_VALIDO;
  }

  const respuesta = await descargarDeApi(ruta, solicitud.signal);

  if (respuesta === null) {
    return new NextResponse('No se pudo generar el reporte o no tiene permiso para verlo.', {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const cabeceras = new Headers();

  for (const nombre of CABECERAS_PERMITIDAS) {
    const valor = respuesta.headers.get(nombre);

    if (valor !== null) {
      cabeceras.set(nombre, valor);
    }
  }

  return new NextResponse(await respuesta.arrayBuffer(), { headers: cabeceras });
}
