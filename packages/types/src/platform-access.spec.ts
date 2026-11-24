import { describe, expect, it } from 'vitest';
import { contieneSecreto, esquemaAccesoEntrada } from './platform-access';

describe('contieneSecreto', () => {
  it('detecta etiquetas de clave seguidas de un valor', () => {
    expect(contieneSecreto('Clave SOL: ABC123')).toBe(true);
    expect(contieneSecreto('contraseña = hola')).toBe(true);
    expect(contieneSecreto('password:x')).toBe(true);
    expect(contieneSecreto('PIN: 1234')).toBe(true);
    expect(contieneSecreto('token=abc')).toBe(true);
  });

  it('detecta tokens, claves de nube, llaves privadas y tarjetas', () => {
    expect(contieneSecreto('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N')).toBe(true);
    expect(contieneSecreto('AKIAIOSFODNN7EXAMPLE')).toBe(true);
    expect(contieneSecreto('-----BEGIN RSA PRIVATE KEY-----')).toBe(true);
    expect(contieneSecreto('Tarjeta 4111 1111 1111 1111')).toBe(true);
    expect(contieneSecreto('https://sitio.pe/login?password=123')).toBe(true);
  });

  it('detecta cadenas que parecen contraseñas aleatorias', () => {
    expect(contieneSecreto('usar Xk9#pQ2!mN7vL4')).toBe(true);
  });

  it('acepta textos normales, correos, direcciones, RUC e identificadores de bóveda', () => {
    expect(contieneSecreto('Usuario secundario creado para declaraciones')).toBe(false);
    expect(contieneSecreto('contabilidad@cliente.com.pe')).toBe(false);
    expect(contieneSecreto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm')).toBe(false);
    expect(contieneSecreto('20131312955')).toBe(false);
    expect(contieneSecreto('3f0c2253-ec1b-4260-b1c0-4ffde11f09ea')).toBe(false);
    expect(contieneSecreto('Revisar la clave cada 90 días')).toBe(false);
  });
});

describe('esquemaAccesoEntrada', () => {
  const base = {
    plataformaId: '3f0c2253-ec1b-4260-b1c0-4ffde11f09ea',
    url: 'https://e-menu.sunat.gob.pe',
    identificador: '20131312955 CONTA01',
    responsableAutorizadoId: '3f0c2253-ec1b-4260-b1c0-4ffde11f09eb',
    fechaRevision: '2026-12-31',
    estado: 'ACTIVO',
    tieneMfa: true,
    referenciaBoveda: 'Bitwarden · Clientes / Cliente Uno / SUNAT',
    notas: '',
  };

  it('acepta un acceso sin secretos', () => {
    expect(esquemaAccesoEntrada.safeParse(base).success).toBe(true);
  });

  it('rechaza secretos en cualquier campo de texto', () => {
    expect(esquemaAccesoEntrada.safeParse({ ...base, notas: 'Clave SOL: MICLAVE1' }).success).toBe(false);
    expect(esquemaAccesoEntrada.safeParse({ ...base, identificador: 'usuario pass: 123' }).success).toBe(false);
    expect(esquemaAccesoEntrada.safeParse({ ...base, referenciaBoveda: 'Xk9#pQ2!mN7vL4zz' }).success).toBe(false);
  });

  it('exige direcciones https', () => {
    expect(esquemaAccesoEntrada.safeParse({ ...base, url: 'ftp://sitio' }).success).toBe(false);
  });
});
