import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITMO = 'aes-256-gcm';
const VERSION_FORMATO = 'v1';
const LONGITUD_IV = 12;
const LONGITUD_CLAVE = 32;

function validarClave(clave: Buffer): void {
  if (clave.length !== LONGITUD_CLAVE) {
    throw new Error('La clave de cifrado debe tener 32 bytes');
  }
}

export function cifrarTexto(texto: string, clave: Buffer): string {
  validarClave(clave);

  const iv = randomBytes(LONGITUD_IV);
  const cifrador = createCipheriv(ALGORITMO, clave, iv);
  const datos = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
  const etiqueta = cifrador.getAuthTag();

  return [
    VERSION_FORMATO,
    iv.toString('base64url'),
    etiqueta.toString('base64url'),
    datos.toString('base64url'),
  ].join(':');
}

export function descifrarTexto(cifrado: string, clave: Buffer): string {
  validarClave(clave);

  const [version, iv, etiqueta, datos] = cifrado.split(':');

  if (version !== VERSION_FORMATO || iv === undefined || etiqueta === undefined || datos === undefined) {
    throw new Error('Formato de texto cifrado no reconocido');
  }

  const descifrador = createDecipheriv(ALGORITMO, clave, Buffer.from(iv, 'base64url'));
  descifrador.setAuthTag(Buffer.from(etiqueta, 'base64url'));

  return Buffer.concat([
    descifrador.update(Buffer.from(datos, 'base64url')),
    descifrador.final(),
  ]).toString('utf8');
}
