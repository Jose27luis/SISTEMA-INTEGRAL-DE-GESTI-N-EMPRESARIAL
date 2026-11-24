import { z } from 'zod';

const PALABRAS_SECRETAS =
  /\b(clave(\s+sol)?|contrase(ñ|n)a|password|passwd|pass|pwd|pin|cvv|cvc|token|secreto|secret|otp|c[oó]digo\s+de\s+(verificaci[oó]n|autenticaci[oó]n|seguridad))\b\s*[:=]/iu;
const TOKEN_JWT = /\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/u;
const CLAVE_PRIVADA = /-----BEGIN [A-Z ]*PRIVATE KEY-----/u;
const CLAVE_NUBE = /\b(AKIA[0-9A-Z]{16}|AIza[\w-]{35}|ghp_[A-Za-z0-9]{36}|xox[baprs]-[\w-]{10,}|sk-[A-Za-z0-9]{20,})\b/u;
const CADENA_CON_PARAMETROS_SECRETOS = /[?&](password|pass|pwd|token|clave|secret)=/iu;
const PALABRA_LARGA = /\S{14,}/gu;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const URL = /^https?:\/\//iu;

function pasaLuhn(digitos: string): boolean {
  let suma = 0;
  let doble = false;

  for (let indice = digitos.length - 1; indice >= 0; indice -= 1) {
    let valor = Number(digitos[indice]);

    if (doble) {
      valor *= 2;
      valor = valor > 9 ? valor - 9 : valor;
    }

    suma += valor;
    doble = !doble;
  }

  return suma % 10 === 0;
}

function pareceTarjeta(texto: string): boolean {
  const candidatos = texto.match(/(?:\d[ -]?){13,19}/gu) ?? [];
  return candidatos.some((candidato) => {
    const digitos = candidato.replace(/\D/gu, '');
    return digitos.length >= 13 && digitos.length <= 19 && pasaLuhn(digitos);
  });
}

function pareceClaveAleatoria(palabra: string): boolean {
  if (UUID.test(palabra) || URL.test(palabra) || /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/u.test(palabra)) {
    return false;
  }

  const clases = [/[a-z]/u, /[A-Z]/u, /\d/u, /[^A-Za-z0-9]/u].filter((clase) => clase.test(palabra)).length;
  return clases >= 3;
}

export function contieneSecreto(texto: string): boolean {
  if (
    PALABRAS_SECRETAS.test(texto) ||
    TOKEN_JWT.test(texto) ||
    CLAVE_PRIVADA.test(texto) ||
    CLAVE_NUBE.test(texto) ||
    CADENA_CON_PARAMETROS_SECRETOS.test(texto) ||
    pareceTarjeta(texto)
  ) {
    return true;
  }

  return (texto.match(PALABRA_LARGA) ?? []).some(pareceClaveAleatoria);
}

export const MENSAJE_SECRETO =
  'Parece contener una contraseña, clave, token o tarjeta. Guárdela en la bóveda y registre aquí solo la referencia.';

const textoSinSecretos = (maximo: number) =>
  z
    .string()
    .trim()
    .max(maximo, `Máximo ${String(maximo)} caracteres.`)
    .refine((valor) => !contieneSecreto(valor), MENSAJE_SECRETO)
    .transform((valor) => (valor === '' ? null : valor))
    .nullable();

export const ESTADOS_ACCESO = ['ACTIVO', 'SUSPENDIDO', 'DADO_DE_BAJA'] as const;

export const esquemaEstadoAcceso = z.enum(ESTADOS_ACCESO);

export type EstadoAcceso = z.infer<typeof esquemaEstadoAcceso>;

export const ETIQUETAS_ESTADO_ACCESO: Record<EstadoAcceso, string> = {
  ACTIVO: 'Activo',
  SUSPENDIDO: 'Suspendido',
  DADO_DE_BAJA: 'Dado de baja',
};

export const esquemaAccesoEntrada = z.object({
  plataformaId: z.uuid('Seleccione la plataforma.'),
  url: textoSinSecretos(300).refine((valor) => valor === null || URL.test(valor), 'Use una dirección que empiece con https://.'),
  identificador: textoSinSecretos(120),
  responsableAutorizadoId: z.uuid('Seleccione al responsable autorizado.'),
  fechaRevision: z.iso.date('Ingrese la próxima fecha de revisión.'),
  estado: esquemaEstadoAcceso,
  tieneMfa: z.boolean(),
  referenciaBoveda: z
    .string()
    .trim()
    .min(3, 'Indique la referencia de la entrada en la bóveda.')
    .max(300)
    .refine((valor) => !contieneSecreto(valor), MENSAJE_SECRETO),
  notas: textoSinSecretos(1000),
});

export type AccesoEntrada = z.infer<typeof esquemaAccesoEntrada>;

export const esquemaPlataforma = z.object({
  id: z.uuid(),
  nombre: z.string(),
  urlPorDefecto: z.string().nullable(),
  activo: z.boolean(),
});

export type Plataforma = z.infer<typeof esquemaPlataforma>;

export const esquemaAcceso = z.object({
  id: z.uuid(),
  plataforma: z.object({ id: z.uuid(), nombre: z.string() }),
  url: z.string().nullable(),
  identificador: z.string().nullable(),
  responsableAutorizado: z.object({ id: z.uuid(), nombre: z.string() }),
  fechaRevision: z.iso.date(),
  revisionVencida: z.boolean(),
  estado: esquemaEstadoAcceso,
  tieneMfa: z.boolean(),
  referenciaBoveda: z.string(),
  notas: z.string().nullable(),
  actualizadoEn: z.iso.datetime(),
});

export type Acceso = z.infer<typeof esquemaAcceso>;

export const esquemaAccesosCliente = z.object({
  clienteId: z.uuid(),
  accesos: z.array(esquemaAcceso),
  puedeGestionar: z.boolean(),
});

export type AccesosCliente = z.infer<typeof esquemaAccesosCliente>;
