import { generateSync } from 'otplib';
import { describe, expect, it } from 'vitest';
import { construirUrlTotp, generarSecretoTotp, verificarCodigoTotp } from './totp';

describe('TOTP', () => {
  const secreto = generarSecretoTotp();

  it('genera secretos base32', () => {
    expect(secreto).toMatch(/^[A-Z2-7]+=*$/);
    expect(secreto.length).toBeGreaterThanOrEqual(16);
  });

  it('acepta el código vigente generado por una aplicación autenticadora', () => {
    expect(verificarCodigoTotp(secreto, generateSync({ secret: secreto }))).toBe(true);
  });

  it('rechaza un código de hace más de un periodo', () => {
    const haceDosMinutos = Math.floor(Date.now() / 1000) - 120;
    const codigoAntiguo = generateSync({ secret: secreto, epoch: haceDosMinutos });

    expect(verificarCodigoTotp(secreto, codigoAntiguo)).toBe(false);
  });

  it('rechaza un código ajeno', () => {
    const otroSecreto = generarSecretoTotp();

    expect(verificarCodigoTotp(secreto, generateSync({ secret: otroSecreto }))).toBe(false);
  });

  it('construye la URL otpauth con el emisor y el correo', () => {
    const url = construirUrlTotp(secreto, 'gerencia@ejemplo.pe');

    expect(url.startsWith('otpauth://totp/')).toBe(true);
    expect(url).toContain(`secret=${secreto}`);
    expect(url).toContain('issuer=TORRES');
  });
});
