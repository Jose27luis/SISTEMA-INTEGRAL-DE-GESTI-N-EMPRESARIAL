import 'server-only';
import { type CodigoPermiso, esquemaPerfil, type Perfil } from '@sige/types';
import { cache } from 'react';
import { solicitarApi } from './api';

export const obtenerPerfil = cache(async (): Promise<Perfil> => {
  const resultado = await solicitarApi('/auth/perfil', { esquema: esquemaPerfil });

  if (!resultado.ok) {
    throw new Error(resultado.error.mensaje);
  }

  return resultado.datos;
});

export function tienePermiso(perfil: Perfil, permiso: CodigoPermiso): boolean {
  return perfil.permisos.includes(permiso);
}

export function rutaPendiente(perfil: Perfil): string | null {
  return perfil.pendientes.includes('CONFIGURAR_MFA') ? '/configurar-mfa' : null;
}
