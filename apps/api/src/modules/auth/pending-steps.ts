import type { PendienteIngreso } from '@sige/types';

export interface EstadoCuenta {
  debeCambiarContrasena: boolean;
  mfaActivo: boolean;
}

export function calcularPendientes(cuenta: EstadoCuenta, exigeMfa: boolean): PendienteIngreso[] {
  const pendientes: PendienteIngreso[] = [];

  if (cuenta.debeCambiarContrasena) {
    pendientes.push('CAMBIAR_CONTRASENA');
  }

  if (exigeMfa && !cuenta.mfaActivo) {
    pendientes.push('CONFIGURAR_MFA');
  }

  return pendientes;
}
