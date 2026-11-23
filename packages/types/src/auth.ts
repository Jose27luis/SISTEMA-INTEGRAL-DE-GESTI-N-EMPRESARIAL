import { z } from 'zod';
import { esquemaCodigoPermiso } from './permissions';

export const LONGITUD_MAXIMA_CONTRASENA = 128;

export const esquemaContrasena = z
  .string()
  .min(1, 'Ingrese la contraseña.')
  .max(LONGITUD_MAXIMA_CONTRASENA, `Máximo ${String(LONGITUD_MAXIMA_CONTRASENA)} caracteres.`);

export const esquemaInicioSesion = z.object({
  correo: z.email().trim().toLowerCase(),
  contrasena: z.string().min(1).max(LONGITUD_MAXIMA_CONTRASENA),
});

export const esquemaSesionIniciada = z.object({
  estado: z.literal('SESION_INICIADA'),
  token: z.string().min(1),
  expiraEn: z.iso.datetime(),
});

export const esquemaMfaRequerido = z.object({
  estado: z.literal('MFA_REQUERIDO'),
  desafioId: z.uuid(),
});

export const esquemaRespuestaInicioSesion = z.discriminatedUnion('estado', [
  esquemaSesionIniciada,
  esquemaMfaRequerido,
]);

export const esquemaVerificacionMfa = z.object({
  desafioId: z.uuid(),
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^(\d{6}|[A-Z2-9]{4}-[A-Z2-9]{4})$/),
});

export const PENDIENTES_INGRESO = ['CONFIGURAR_MFA'] as const;

export const esquemaPendienteIngreso = z.enum(PENDIENTES_INGRESO);

export const esquemaRolReferencia = z.object({
  id: z.uuid(),
  codigo: z.string(),
  nombre: z.string(),
});

export const esquemaPerfil = z.object({
  usuario: z.object({
    id: z.uuid(),
    nombre: z.string(),
    correo: z.string(),
    mfaActivo: z.boolean(),
    ultimoIngreso: z.iso.datetime().nullable(),
  }),
  roles: z.array(esquemaRolReferencia),
  permisos: z.array(esquemaCodigoPermiso),
  alcanceGlobal: z.boolean(),
  exigeMfa: z.boolean(),
  pendientes: z.array(esquemaPendienteIngreso),
});

export const esquemaCambioContrasena = z.object({
  actual: z.string().min(1).max(LONGITUD_MAXIMA_CONTRASENA),
  nueva: esquemaContrasena,
});

export const esquemaConfiguracionMfa = z.object({
  secreto: z.string(),
  urlOtpauth: z.string(),
  qrSvg: z.string(),
});

export const esquemaActivacionMfa = z.object({
  codigo: z.string().trim().regex(/^\d{6}$/),
});

export const esquemaCodigosRecuperacion = z.object({
  codigos: z.array(z.string()),
});

export const esquemaSesionResumen = z.object({
  id: z.uuid(),
  ip: z.string().nullable(),
  agenteUsuario: z.string().nullable(),
  creadaEn: z.iso.datetime(),
  ultimoUso: z.iso.datetime(),
  expiraEn: z.iso.datetime(),
  actual: z.boolean(),
});

export type InicioSesion = z.infer<typeof esquemaInicioSesion>;
export type SesionIniciada = z.infer<typeof esquemaSesionIniciada>;
export type RespuestaInicioSesion = z.infer<typeof esquemaRespuestaInicioSesion>;
export type VerificacionMfa = z.infer<typeof esquemaVerificacionMfa>;
export type PendienteIngreso = z.infer<typeof esquemaPendienteIngreso>;
export type RolReferencia = z.infer<typeof esquemaRolReferencia>;
export type Perfil = z.infer<typeof esquemaPerfil>;
export type CambioContrasena = z.infer<typeof esquemaCambioContrasena>;
export type ConfiguracionMfa = z.infer<typeof esquemaConfiguracionMfa>;
export type ActivacionMfa = z.infer<typeof esquemaActivacionMfa>;
export type CodigosRecuperacion = z.infer<typeof esquemaCodigosRecuperacion>;
export type SesionResumen = z.infer<typeof esquemaSesionResumen>;
