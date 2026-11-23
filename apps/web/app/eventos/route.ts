import { type NextRequest, NextResponse } from 'next/server';
import { descargarDeApi } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(solicitud: NextRequest): Promise<NextResponse> {
  const respuesta = await descargarDeApi('/notificaciones/eventos', solicitud.signal);

  if (respuesta === null || respuesta.body === null) {
    return new NextResponse(null, { status: 204 });
  }

  return new NextResponse(respuesta.body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
