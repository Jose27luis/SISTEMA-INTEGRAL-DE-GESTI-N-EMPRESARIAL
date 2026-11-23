import { LONGITUD_MAXIMA_CONTRASENA, LONGITUD_MINIMA_CONTRASENA } from '@sige/types';

const FRAGMENTOS_PREDECIBLES = [
  'password',
  'contrasena',
  'clave',
  'qwerty',
  'asdfgh',
  '123456',
  '654321',
  'abcdef',
  'admin',
  'torres',
  'sige',
] as const;

const LONGITUD_MINIMA_FRAGMENTO_PERSONAL = 4;

export interface ContextoContrasena {
  correo: string;
  nombre: string;
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export function evaluarContrasena(contrasena: string, contexto: ContextoContrasena): string[] {
  const problemas: string[] = [];
  const normalizada = normalizar(contrasena);

  if (contrasena.length < LONGITUD_MINIMA_CONTRASENA) {
    problemas.push(`Debe tener al menos ${String(LONGITUD_MINIMA_CONTRASENA)} caracteres.`);
  }

  if (contrasena.length > LONGITUD_MAXIMA_CONTRASENA) {
    problemas.push(`No puede superar ${String(LONGITUD_MAXIMA_CONTRASENA)} caracteres.`);
  }

  if (/^(.)\1+$/u.test(contrasena)) {
    problemas.push('No puede repetir un único carácter.');
  }

  if (FRAGMENTOS_PREDECIBLES.some((fragmento) => normalizada.includes(fragmento))) {
    problemas.push(
      'No puede contener palabras o secuencias predecibles como "password", "123456" o el nombre de la empresa.',
    );
  }

  const usuarioCorreo = normalizar(contexto.correo.split('@')[0] ?? '');

  if (usuarioCorreo.length >= LONGITUD_MINIMA_FRAGMENTO_PERSONAL && normalizada.includes(usuarioCorreo)) {
    problemas.push('No puede contener su usuario de correo.');
  }

  const partesNombre = normalizar(contexto.nombre)
    .split(/\s+/u)
    .filter((parte) => parte.length >= LONGITUD_MINIMA_FRAGMENTO_PERSONAL);

  if (partesNombre.some((parte) => normalizada.includes(parte))) {
    problemas.push('No puede contener su nombre.');
  }

  return problemas;
}
