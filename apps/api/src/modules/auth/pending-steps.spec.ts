import { describe, expect, it } from 'vitest';
import { calcularPendientes } from './pending-steps';

describe('calcularPendientes', () => {
  it('no exige nada a una cuenta al día', () => {
    expect(calcularPendientes({ debeCambiarContrasena: false, mfaActivo: true }, true)).toEqual([]);
  });

  it('exige cambiar la contraseña temporal', () => {
    expect(calcularPendientes({ debeCambiarContrasena: true, mfaActivo: false }, false)).toEqual([
      'CAMBIAR_CONTRASENA',
    ]);
  });

  it('exige configurar MFA solo cuando algún rol lo requiere', () => {
    expect(calcularPendientes({ debeCambiarContrasena: false, mfaActivo: false }, true)).toEqual([
      'CONFIGURAR_MFA',
    ]);
    expect(calcularPendientes({ debeCambiarContrasena: false, mfaActivo: false }, false)).toEqual([]);
  });

  it('acumula ambos pendientes en orden', () => {
    expect(calcularPendientes({ debeCambiarContrasena: true, mfaActivo: false }, true)).toEqual([
      'CAMBIAR_CONTRASENA',
      'CONFIGURAR_MFA',
    ]);
  });
});
