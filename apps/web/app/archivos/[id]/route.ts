import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { descargarDeApi } from '@/lib/api';

const CABECERAS_PERMITIDAS = [
  'content-type',
  'content-length',
  'content-disposition',
  'x-content-type-options',
  'cache-control',
  'content-security-policy',
];

export async function GET(
  solicitud: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    return new NextResponse('Archivo no válido.', { status: 404 });
  }

  const descarga = solicitud.nextUrl.searchParams.get('descarga') === '1' ? '?descarga=1' : '';
  const respuesta = await descargarDeApi(`/archivos/${id}${descarga}`, solicitud.signal);

  if (respuesta === null || respuesta.body === null) {
    return new NextResponse('No tiene acceso a este archivo o ya no está disponible.', {
      status: 404,
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

  return new NextResponse(respuesta.body, { headers: cabeceras });
}
