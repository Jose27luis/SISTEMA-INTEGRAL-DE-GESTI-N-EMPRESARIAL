import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cifrarTexto, descifrarTexto } from './secret-cipher';

describe('cifrado de secretos', () => {
  const clave = randomBytes(32);

  it('descifra lo que cifra', () => {
    const cifrado = cifrarTexto('JBSWY3DPEHPK3PXP', clave);

    expect(cifrado.startsWith('v1:')).toBe(true);
    expect(cifrado).not.toContain('JBSWY3DPEHPK3PXP');
    expect(descifrarTexto(cifrado, clave)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('produce un resultado distinto en cada cifrado del mismo texto', () => {
    expect(cifrarTexto('secreto', clave)).not.toBe(cifrarTexto('secreto', clave));
  });

  it('rechaza un texto cifrado alterado', () => {
    const partes = cifrarTexto('secreto', clave).split(':');
    const datos = partes[3] ?? '';
    const alterado = [partes[0], partes[1], partes[2], `${datos.slice(0, -2)}AA`].join(':');

    expect(() => descifrarTexto(alterado, clave)).toThrow();
  });

  it('rechaza una clave distinta', () => {
    const cifrado = cifrarTexto('secreto', clave);

    expect(() => descifrarTexto(cifrado, randomBytes(32))).toThrow();
  });

  it('exige una clave de 32 bytes', () => {
    expect(() => cifrarTexto('secreto', randomBytes(16))).toThrow('32 bytes');
  });
});
