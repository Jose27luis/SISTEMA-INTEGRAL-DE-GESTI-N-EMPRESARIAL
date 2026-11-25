import 'server-only';
import { headers } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { leerEntorno } from './environment';
import { leerSesion } from './session-cookie';

const CABECERAS_DE_ENTRADA = ['content-type', 'content-length', 'range', 'if-none-match', 'x-sige-subida'];

const CABECERAS_DE_SALIDA = [
  'content-type',
  'content-length',
  'content-disposition',
  'content-range',
  'accept-ranges',
  'etag',
  'cache-control',
  'x-content-type-options',
  'content-security-policy',
];

export async function reenviarAApi(solicitud: NextRequest, ruta: string): Promise<NextResponse> {
  const token = await leerSesion();

  if (token === null) {
    return NextResponse.json({ mensaje: 'Inicie sesión para continuar.', errores: [] }, { status: 401 });
  }

  const entrantes = await headers();
  const salientes = new Headers({ authorization: `Bearer ${token}` });
  const ip = entrantes.get('x-real-ip') ?? entrantes.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const agente = entrantes.get('user-agent');

  if (ip !== null && ip !== '') {
    salientes.set('x-cliente-ip', ip);
  }

  if (agente !== null) {
    salientes.set('x-agente-usuario', agente);
  }

  for (const nombre of CABECERAS_DE_ENTRADA) {
    const valor = solicitud.headers.get(nombre);

    if (valor !== null) {
      salientes.set(nombre, valor);
    }
  }

  const conCuerpo = solicitud.method !== 'GET' && solicitud.method !== 'HEAD';
  let respuesta: Response;

  try {
    respuesta = await fetch(`${leerEntorno().API_INTERNAL_URL}${ruta}`, {
      method: solicitud.method,
      headers: salientes,
      cache: 'no-store',
      signal: solicitud.signal,
      ...(conCuerpo ? { body: solicitud.body, duplex: 'half' } : {}),
    });
  } catch {
    return NextResponse.json(
      { mensaje: 'No se pudo conectar con el servidor. Intente nuevamente.', errores: [] },
      { status: 503 },
    );
  }

  const cabeceras = new Headers();

  for (const nombre of CABECERAS_DE_SALIDA) {
    const valor = respuesta.headers.get(nombre);

    if (valor !== null) {
      cabeceras.set(nombre, valor);
    }
  }

  return new NextResponse(respuesta.status === 304 ? null : respuesta.body, { status: respuesta.status, headers: cabeceras });
}
