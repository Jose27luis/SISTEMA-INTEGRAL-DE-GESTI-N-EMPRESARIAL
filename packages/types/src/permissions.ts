import { z } from 'zod';

export const CODIGOS_PERMISO = [
  'usuario:ver',
  'usuario:gestionar',
  'sesion:revocar',
  'rol:ver',
  'rol:gestionar',
  'auditoria:ver',
] as const;

export const esquemaCodigoPermiso = z.enum(CODIGOS_PERMISO);

export type CodigoPermiso = z.infer<typeof esquemaCodigoPermiso>;

export const ALCANCES_ROL = ['GLOBAL', 'ASIGNADO', 'PROPIO'] as const;

export const esquemaAlcanceRol = z.enum(ALCANCES_ROL);

export type AlcanceRol = z.infer<typeof esquemaAlcanceRol>;

export const ETIQUETAS_ALCANCE: Record<AlcanceRol, string> = {
  GLOBAL: 'Global: todos los clientes y registros',
  ASIGNADO: 'Asignado: solo clientes asignados',
  PROPIO: 'Propio: solo registros propios',
};
