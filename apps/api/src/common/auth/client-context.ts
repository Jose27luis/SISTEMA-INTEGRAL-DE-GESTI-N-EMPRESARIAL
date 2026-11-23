import type { Request } from 'express';
import type { ContextoCliente } from './authenticated-request';

const LONGITUD_MAXIMA_CABECERA = 300;

function leerCabecera(solicitud: Request, nombre: string): string | null {
  const valor = solicitud.headers[nombre];
  const texto = Array.isArray(valor) ? valor[0] : valor;

  if (texto === undefined) {
    return null;
  }

  const limpio = texto.trim();

  return limpio === '' ? null : limpio.slice(0, LONGITUD_MAXIMA_CABECERA);
}

export function obtenerContextoCliente(solicitud: Request): ContextoCliente {
  return {
    ip: leerCabecera(solicitud, 'x-cliente-ip') ?? solicitud.ip ?? null,
    agenteUsuario:
      leerCabecera(solicitud, 'x-agente-usuario') ?? leerCabecera(solicitud, 'user-agent'),
  };
}

export function extraerTokenPortador(solicitud: Request): string | null {
  const autorizacion = leerCabecera(solicitud, 'authorization');

  if (autorizacion === null) {
    return null;
  }

  const [esquema, token] = autorizacion.split(' ');

  return esquema === 'Bearer' && token !== undefined && token !== '' ? token : null;
}
