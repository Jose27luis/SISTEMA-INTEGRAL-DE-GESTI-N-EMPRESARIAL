import 'server-only';
import { type ErrorApi, esquemaErrorApi } from '@sige/types';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { z } from 'zod';
import { leerEntorno } from './environment';
import { leerSesion } from './session-cookie';

export type ResultadoApi<T> = { ok: true; datos: T } | { ok: false; estado: number; error: ErrorApi };

type MetodoHttp = 'GET' | 'POST' | 'PUT';

interface OpcionesSolicitud<T extends z.ZodType> {
  esquema: T;
  metodo?: MetodoHttp;
  cuerpo?: unknown;
  formulario?: FormData;
  autenticado?: boolean;
}

function construirCuerpo(opciones: { cuerpo?: unknown; formulario?: FormData }): { body: BodyInit } | object {
  if (opciones.formulario !== undefined) {
    return { body: opciones.formulario };
  }

  return opciones.cuerpo === undefined ? {} : { body: JSON.stringify(opciones.cuerpo) };
}

const ERROR_CONEXION: ErrorApi = {
  mensaje: 'No se pudo conectar con el servidor. Intente nuevamente en unos segundos.',
  errores: [],
};

const ERROR_RESPUESTA: ErrorApi = {
  mensaje: 'El servidor devolvió una respuesta inesperada.',
  errores: [],
};

async function cabecerasCliente(): Promise<Headers> {
  const entrantes = await headers();
  const salientes = new Headers({ Accept: 'application/json' });
  const ip =
    entrantes.get('x-real-ip') ?? entrantes.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const agente = entrantes.get('user-agent');

  if (ip !== null && ip !== '') {
    salientes.set('x-cliente-ip', ip);
  }

  if (agente !== null) {
    salientes.set('x-agente-usuario', agente);
  }

  return salientes;
}

async function leerCuerpo(respuesta: Response): Promise<unknown> {
  if (respuesta.status === 204) {
    return null;
  }

  try {
    const cuerpo: unknown = await respuesta.json();
    return cuerpo;
  } catch {
    return undefined;
  }
}

export async function solicitarApi<T extends z.ZodType>(
  ruta: string,
  opciones: OpcionesSolicitud<T>,
): Promise<ResultadoApi<z.output<T>>> {
  const autenticado = opciones.autenticado ?? true;
  const cabeceras = await cabecerasCliente();

  if (autenticado) {
    const token = await leerSesion();

    if (token === null) {
      redirect('/ingresar');
    }

    cabeceras.set('authorization', `Bearer ${token}`);
  }

  if (opciones.cuerpo !== undefined && opciones.formulario === undefined) {
    cabeceras.set('content-type', 'application/json');
  }

  let respuesta: Response;

  try {
    respuesta = await fetch(`${leerEntorno().API_INTERNAL_URL}${ruta}`, {
      method: opciones.metodo ?? 'GET',
      headers: cabeceras,
      cache: 'no-store',
      ...construirCuerpo(opciones),
    });
  } catch {
    return { ok: false, estado: 503, error: ERROR_CONEXION };
  }

  if (autenticado && respuesta.status === 401) {
    redirect('/sesion-expirada');
  }

  const cuerpo = await leerCuerpo(respuesta);

  if (!respuesta.ok) {
    const error = esquemaErrorApi.safeParse(cuerpo);
    return { ok: false, estado: respuesta.status, error: error.success ? error.data : ERROR_RESPUESTA };
  }

  const datos = opciones.esquema.safeParse(cuerpo);

  if (!datos.success) {
    return { ok: false, estado: 502, error: ERROR_RESPUESTA };
  }

  return { ok: true, datos: datos.data };
}

export async function descargarDeApi(ruta: string): Promise<Response | null> {
  const token = await leerSesion();

  if (token === null) {
    return null;
  }

  const cabeceras = await cabecerasCliente();
  cabeceras.set('authorization', `Bearer ${token}`);
  cabeceras.delete('accept');

  try {
    const respuesta = await fetch(`${leerEntorno().API_INTERNAL_URL}${ruta}`, {
      headers: cabeceras,
      cache: 'no-store',
    });

    return respuesta.ok ? respuesta : null;
  } catch {
    return null;
  }
}
