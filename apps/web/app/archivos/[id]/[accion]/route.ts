import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { reenviarAApi } from '@/lib/api-proxy';

const ACCIONES = new Set(['info', 'vista', 'hojas']);

export async function GET(
  solicitud: NextRequest,
  { params }: { params: Promise<{ id: string; accion: string }> },
): Promise<NextResponse> {
  const { id, accion } = await params;

  if (!z.uuid().safeParse(id).success || !ACCIONES.has(accion)) {
    return new NextResponse('Archivo no válido.', { status: 404 });
  }

  return reenviarAApi(solicitud, `/archivos/${id}/${accion}`);
}
