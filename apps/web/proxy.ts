import { type NextRequest, NextResponse } from 'next/server';
import { COOKIE_SESION } from './lib/session-constants';

const RUTAS_PUBLICAS = ['/ingresar', '/estado', '/sesion-expirada'];

function esPublica(ruta: string): boolean {
  return RUTAS_PUBLICAS.some((publica) => ruta === publica || ruta.startsWith(`${publica}/`));
}

export function proxy(solicitud: NextRequest): NextResponse {
  const ruta = solicitud.nextUrl.pathname;

  if (esPublica(ruta) || solicitud.cookies.has(COOKIE_SESION)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL('/ingresar', solicitud.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|brand/|favicon.ico|icon.png).*)'],
};
