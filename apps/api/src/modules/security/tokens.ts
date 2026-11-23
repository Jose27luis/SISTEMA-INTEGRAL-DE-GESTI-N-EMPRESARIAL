import { createHash, randomBytes } from 'node:crypto';

const ALFABETO_CODIGOS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LONGITUD_TOKEN_SESION = 32;
const CARACTERES_CODIGO = 8;

export function generarTokenSesion(): string {
  return randomBytes(LONGITUD_TOKEN_SESION).toString('base64url');
}

export function resumirSecreto(valor: string): string {
  return createHash('sha256').update(valor, 'utf8').digest('hex');
}

export function generarCodigoRecuperacion(): string {
  const bytes = randomBytes(CARACTERES_CODIGO);
  let codigo = '';

  for (const byte of bytes) {
    codigo += ALFABETO_CODIGOS.charAt(byte % ALFABETO_CODIGOS.length);
  }

  return `${codigo.slice(0, 4)}-${codigo.slice(4)}`;
}

export function generarContrasenaTemporal(): string {
  return randomBytes(18).toString('base64url');
}
