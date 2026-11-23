import { esquemaVerificacionMfa } from '@sige/types';
import { describe, expect, it } from 'vitest';
import { generarCodigoRecuperacion, generarTokenSesion, resumirSecreto } from './tokens';

describe('tokens y códigos', () => {
  it('genera tokens de sesión distintos de 43 caracteres base64url', () => {
    const primero = generarTokenSesion();

    expect(primero).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generarTokenSesion()).not.toBe(primero);
  });

  it('resume secretos con SHA-256 de forma determinista', () => {
    expect(resumirSecreto('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('genera códigos de recuperación que el esquema de verificación acepta', () => {
    for (let indice = 0; indice < 50; indice += 1) {
      const codigo = generarCodigoRecuperacion();

      expect(codigo).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(
        esquemaVerificacionMfa.safeParse({
          desafioId: '0b7e7c1e-2f5a-4c1e-9d7a-3c2b1a0f9e8d',
          codigo: codigo.toLowerCase(),
        }).success,
      ).toBe(true);
    }
  });
});
