import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { COOKIE_SESION } from '@/lib/session-constants';

export async function GET(solicitud: NextRequest): Promise<NextResponse> {
  const almacen = await cookies();
  almacen.delete(COOKIE_SESION);

  return NextResponse.redirect(new URL('/ingresar?motivo=expirada', solicitud.url));
}
