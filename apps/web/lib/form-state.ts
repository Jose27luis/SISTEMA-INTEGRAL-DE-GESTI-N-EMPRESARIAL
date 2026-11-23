import type { ErrorApi } from '@sige/types';

export interface EstadoFormulario {
  mensaje: string | null;
  exito: boolean;
  errores: Partial<Record<string, string>>;
  valores: Partial<Record<string, string>>;
}

export const ESTADO_INICIAL: EstadoFormulario = {
  mensaje: null,
  exito: false,
  errores: {},
  valores: {},
};

export function estadoConError(
  error: ErrorApi,
  valores: Partial<Record<string, string>> = {},
): EstadoFormulario {
  const errores: Partial<Record<string, string>> = {};

  for (const { campo, mensaje } of error.errores) {
    errores[campo] ??= mensaje;
  }

  return { mensaje: error.mensaje, exito: false, errores, valores };
}

export function estadoExitoso(mensaje: string): EstadoFormulario {
  return { mensaje, exito: true, errores: {}, valores: {} };
}

export function leerTexto(datos: FormData, campo: string): string {
  const valor = datos.get(campo);
  return typeof valor === 'string' ? valor : '';
}

export function leerLista(datos: FormData, campo: string): string[] {
  return datos.getAll(campo).filter((valor): valor is string => typeof valor === 'string');
}
