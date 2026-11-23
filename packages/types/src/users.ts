import { z } from 'zod';
import { esquemaRolReferencia, esquemaSesionResumen } from './auth';

export const esquemaUsuarioResumen = z.object({
  id: z.uuid(),
  nombre: z.string(),
  correo: z.string(),
  activo: z.boolean(),
  mfaActivo: z.boolean(),
  bloqueadoHasta: z.iso.datetime().nullable(),
  ultimoIngreso: z.iso.datetime().nullable(),
  roles: z.array(esquemaRolReferencia),
});

export const esquemaUsuarioDetalle = esquemaUsuarioResumen.extend({
  creadoEn: z.iso.datetime(),
  sesiones: z.array(esquemaSesionResumen),
});

export const esquemaAsignacionRoles = z.object({
  rolIds: z.array(z.uuid()).max(20),
});

export const esquemaContrasenaTemporal = z.object({
  contrasenaTemporal: z.string().min(1),
});

export type ContrasenaTemporal = z.infer<typeof esquemaContrasenaTemporal>;
export type UsuarioResumen = z.infer<typeof esquemaUsuarioResumen>;
export type UsuarioDetalle = z.infer<typeof esquemaUsuarioDetalle>;
export type AsignacionRoles = z.infer<typeof esquemaAsignacionRoles>;
