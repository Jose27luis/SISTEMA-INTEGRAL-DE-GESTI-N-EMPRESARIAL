import { NextResponse } from 'next/server';
import { descargarDeApi } from '@/lib/api';

export async function GET(): Promise<NextResponse> {
  const respuesta = await descargarDeApi('/clientes/importacion/plantilla');

  if (respuesta === null) {
    return new NextResponse('No se pudo generar la plantilla.', { status: 502 });
  }

  return new NextResponse(await respuesta.arrayBuffer(), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-clientes.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
