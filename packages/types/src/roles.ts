import { z } from 'zod';
import { esquemaAlcanceRol, esquemaCodigoPermiso } from './permissions';

export const esquemaPermiso = z.object({
  id: z.uuid(),
  codigo: esquemaCodigoPermiso,
  modulo: z.string(),
  descripcion: z.string(),
  sensible: z.boolean(),
});

export const esquemaRolResumen = z.object({
  id: z.uuid(),
  codigo: z.string(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  alcance: esquemaAlcanceRol,
  exigeMfa: z.boolean(),
  esSistema: z.boolean(),
  activo: z.boolean(),
  totalUsuarios: z.number().int().nonnegative(),
  permisoIds: z.array(z.uuid()),
});

export const esquemaCreacionRol = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9_]{2,39}$/),
  nombre: z.string().trim().min(3).max(80),
  descripcion: z.string().trim().max(300).nullable(),
  alcance: esquemaAlcanceRol,
  exigeMfa: z.boolean(),
  permisoIds: z.array(z.uuid()).max(200),
});

export const esquemaEdicionRol = esquemaCreacionRol.omit({ codigo: true, alcance: true });

export type Permiso = z.infer<typeof esquemaPermiso>;
export type RolResumen = z.infer<typeof esquemaRolResumen>;
export type CreacionRol = z.infer<typeof esquemaCreacionRol>;
export type EdicionRol = z.infer<typeof esquemaEdicionRol>;
