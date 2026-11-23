import { describe, expect, it } from 'vitest';
import { calcularPendientes } from './pending-steps';

describe('calcularPendientes', () => {
  it('no exige nada a una cuenta con MFA activo', () => {
    expect(calcularPendientes({ mfaActivo: true }, true)).toEqual([]);
  });

  it('exige configurar MFA cuando algún rol lo requiere y no está activo', () => {
    expect(calcularPendientes({ mfaActivo: false }, true)).toEqual(['CONFIGURAR_MFA']);
  });

  it('no exige MFA cuando ningún rol lo requiere', () => {
    expect(calcularPendientes({ mfaActivo: false }, false)).toEqual([]);
  });
});
