import { z } from 'zod';
import { esquemaMetadatosPagina } from './common';

export const TIPOS_NOTIFICACION = [
  'TAREA_ASIGNADA',
  'TAREA_MODIFICADA',
  'TAREA_POR_VENCER',
  'TAREA_ATRASADA',
  'AVANCE_REGISTRADO',
  'MENCION',
  'TAREA_REASIGNADA',
] as const;

export const esquemaTipoNotificacion = z.enum(TIPOS_NOTIFICACION);

export type TipoNotificacion = z.infer<typeof esquemaTipoNotificacion>;

export const esquemaNotificacion = z.object({
  id: z.uuid(),
  tipo: esquemaTipoNotificacion,
  titulo: z.string(),
  mensaje: z.string(),
  enlace: z.string(),
  leida: z.boolean(),
  creadoEn: z.iso.datetime(),
});

export const esquemaPaginaNotificaciones = esquemaMetadatosPagina.extend({
  elementos: z.array(esquemaNotificacion),
  noLeidas: z.number().int().nonnegative(),
});

export const esquemaResumenNotificaciones = z.object({
  noLeidas: z.number().int().nonnegative(),
  recientes: z.array(esquemaNotificacion),
});

export type Notificacion = z.infer<typeof esquemaNotificacion>;
export type PaginaNotificaciones = z.infer<typeof esquemaPaginaNotificaciones>;
export type ResumenNotificaciones = z.infer<typeof esquemaResumenNotificaciones>;
