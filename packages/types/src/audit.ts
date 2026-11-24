import { z } from 'zod';
import { esquemaMetadatosPagina } from './common';

export const ACCIONES_AUDITORIA = [
  'CREAR',
  'MODIFICAR',
  'ACTIVAR',
  'DESACTIVAR',
  'INGRESAR',
  'INGRESO_FALLIDO',
  'SALIR',
  'REVOCAR_SESION',
  'PERMISO_DENEGADO',
  'CAMBIAR_ESTADO',
  'DESCARGAR',
  'ARCHIVAR',
  'CONSULTAR',
  'ANULAR',
] as const;

export const esquemaAccionAuditoria = z.enum(ACCIONES_AUDITORIA);

export type AccionAuditoria = z.infer<typeof esquemaAccionAuditoria>;

export const ETIQUETAS_ACCION_AUDITORIA: Record<AccionAuditoria, string> = {
  CREAR: 'Creación',
  MODIFICAR: 'Modificación',
  ACTIVAR: 'Activación',
  DESACTIVAR: 'Desactivación',
  INGRESAR: 'Inicio de sesión',
  INGRESO_FALLIDO: 'Ingreso fallido',
  SALIR: 'Cierre de sesión',
  REVOCAR_SESION: 'Revocación de sesión',
  PERMISO_DENEGADO: 'Permiso denegado',
  CAMBIAR_ESTADO: 'Cambio de estado',
  DESCARGAR: 'Descarga',
  ARCHIVAR: 'Archivo',
  CONSULTAR: 'Consulta',
  ANULAR: 'Anulación',
};

export const esquemaRegistroAuditoria = z.object({
  id: z.string(),
  fecha: z.iso.datetime(),
  usuario: z
    .object({
      id: z.uuid(),
      nombre: z.string(),
    })
    .nullable(),
  ip: z.string().nullable(),
  accion: esquemaAccionAuditoria,
  entidad: z.string(),
  entidadId: z.string().nullable(),
  antes: z.json().nullable(),
  despues: z.json().nullable(),
  motivo: z.string().nullable(),
});

const esquemaTextoOpcional = z
  .string()
  .trim()
  .max(100)
  .transform((valor) => (valor === '' ? undefined : valor))
  .optional();

const esquemaFechaOpcional = z
  .string()
  .trim()
  .transform((valor) => (valor === '' ? undefined : valor))
  .pipe(z.iso.date().optional())
  .optional();

export const esquemaFiltroAuditoria = z.object({
  usuarioId: z
    .string()
    .trim()
    .transform((valor) => (valor === '' ? undefined : valor))
    .pipe(z.uuid().optional())
    .optional(),
  entidad: esquemaTextoOpcional,
  accion: z
    .string()
    .trim()
    .transform((valor) => (valor === '' ? undefined : valor))
    .pipe(esquemaAccionAuditoria.optional())
    .optional(),
  desde: esquemaFechaOpcional,
  hasta: esquemaFechaOpcional,
  pagina: z.coerce.number().int().positive().max(100000).default(1),
});

export const esquemaPaginaAuditoria = esquemaMetadatosPagina.extend({
  elementos: z.array(esquemaRegistroAuditoria),
});

export type RegistroAuditoria = z.infer<typeof esquemaRegistroAuditoria>;
export type PaginaAuditoria = z.infer<typeof esquemaPaginaAuditoria>;
export type FiltroAuditoria = z.infer<typeof esquemaFiltroAuditoria>;
