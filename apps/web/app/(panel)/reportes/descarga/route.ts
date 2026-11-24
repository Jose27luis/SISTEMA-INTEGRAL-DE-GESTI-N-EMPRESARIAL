import { esquemaFiltroPeriodo, esquemaFormatoExportacion } from '@sige/types';
import { type NextRequest, NextResponse } from 'next/server';
import { descargarDeApi } from '@/lib/api';

const CABECERAS_PERMITIDAS = ['content-type', 'content-disposition', 'cache-control', 'x-content-type-options'];

export async function GET(solicitud: NextRequest): Promise<NextResponse> {
  const parametros = solicitud.nextUrl.searchParams;
  const tipo = parametros.get('tipo') === 'actividades' ? 'actividades' : 'personal';
  const formato = esquemaFormatoExportacion.safeParse(parametros.get('formato'));
  const filtro = esquemaFiltroPeriodo.safeParse({
    desde: parametros.get('desde') ?? '',
    hasta: parametros.get('hasta') ?? '',
    areaId: parametros.get('areaId') ?? '',
    usuarioId: parametros.get('usuarioId') ?? '',
  });

  if (!formato.success || !filtro.success) {
    return new NextResponse('Los filtros del reporte no son válidos.', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const consulta = new URLSearchParams({ desde: filtro.data.desde, hasta: filtro.data.hasta, formato: formato.data });

  if (filtro.data.areaId !== undefined) {
    consulta.set('areaId', filtro.data.areaId);
  }

  if (filtro.data.usuarioId !== undefined) {
    consulta.set('usuarioId', filtro.data.usuarioId);
  }

  const respuesta = await descargarDeApi(`/reportes/${tipo}?${consulta.toString()}`, solicitud.signal);

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
