import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { reenviarAApi } from '@/lib/api-proxy';

export async function GET(
  solicitud: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    return new NextResponse('Archivo no válido.', { status: 404 });
  }

  const descarga = solicitud.nextUrl.searchParams.get('descarga') === '1' ? '?descarga=1' : '';
  return reenviarAApi(solicitud, `/archivos/${id}${descarga}`);
}
