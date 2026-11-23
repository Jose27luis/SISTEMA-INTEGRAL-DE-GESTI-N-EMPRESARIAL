import { generateSecret, generateURI, verifySync } from 'otplib';

export const EMISOR_TOTP = 'TORRES ASOCIADOS SIGE';

const TOLERANCIA_SEGUNDOS = 30;

export function generarSecretoTotp(): string {
  return generateSecret();
}

export function construirUrlTotp(secreto: string, correo: string): string {
  return generateURI({ issuer: EMISOR_TOTP, label: correo, secret: secreto });
}

export function verificarCodigoTotp(secreto: string, codigo: string): boolean {
  return verifySync({ secret: secreto, token: codigo, epochTolerance: TOLERANCIA_SEGUNDOS }).valid;
}
