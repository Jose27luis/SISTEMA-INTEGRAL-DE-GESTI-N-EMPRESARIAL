import type { PendienteIngreso } from '@sige/types';

export interface EstadoCuenta {
  mfaActivo: boolean;
}

export function calcularPendientes(cuenta: EstadoCuenta, exigeMfa: boolean): PendienteIngreso[] {
  return exigeMfa && !cuenta.mfaActivo ? ['CONFIGURAR_MFA'] : [];
}
