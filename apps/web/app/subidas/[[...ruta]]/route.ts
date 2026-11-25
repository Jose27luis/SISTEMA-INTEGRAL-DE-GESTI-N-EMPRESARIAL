import type { NextRequest, NextResponse } from 'next/server';
import { reenviarAApi } from '@/lib/api-proxy';

interface Contexto {
  params: Promise<{ ruta?: string[] }>;
}

const SEGMENTO_VALIDO = /^[0-9a-z-]+$/u;

async function reenviar(solicitud: NextRequest, { params }: Contexto): Promise<NextResponse> {
  const { ruta = [] } = await params;
  const segmentos = ruta.filter((segmento) => SEGMENTO_VALIDO.test(segmento));
  const consulta = solicitud.nextUrl.search;

  return reenviarAApi(solicitud, `/subidas${segmentos.length === 0 ? '' : `/${segmentos.join('/')}`}${consulta}`);
}

export const GET = reenviar;
export const POST = reenviar;
export const PUT = reenviar;
