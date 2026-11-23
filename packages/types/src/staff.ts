import { z } from 'zod';
import { esquemaContrasena, esquemaRolReferencia } from './auth';
import { esquemaReferenciaCatalogo } from './catalogs';
import { esDniValido } from './identity-documents';

export const ESTADOS_TRABAJADOR = ['ACTIVO', 'INACTIVO'] as const;

export const esquemaEstadoTrabajador = z.enum(ESTADOS_TRABAJADOR);

const textoOpcional = (maximo: number) =>
  z
    .string()
    .trim()
    .max(maximo, `Máximo ${String(maximo)} caracteres.`)
    .transform((valor) => (valor === '' ? null : valor))
    .nullable();

export const esquemaFichaTrabajador = z.object({
  nombres: z.string().trim().min(2, 'Ingrese los nombres.').max(80),
  apellidos: z.string().trim().min(2, 'Ingrese los apellidos.').max(80),
  dni: z.string().trim().refine(esDniValido, 'El DNI debe tener 8 dígitos.'),
  cargoId: z.uuid('Seleccione un cargo.'),
  areaId: z.uuid('Seleccione un área.'),
  tipoVinculoId: z.uuid('Seleccione un tipo de vínculo.'),
  fechaIncorporacion: z.iso.date('Ingrese la fecha de incorporación.'),
  horario: textoOpcional(120),
  telefono: textoOpcional(30),
  funciones: textoOpcional(1000),
  supervisorId: z.uuid().nullable(),
});

export const esquemaCuentaNueva = z.object({
  tipo: z.literal('NUEVA'),
  correo: z.email('Ingrese un correo válido.').trim().toLowerCase(),
  contrasena: esquemaContrasena,
  rolIds: z.array(z.uuid()).min(1, 'Asigne al menos un rol.').max(20),
});

export const esquemaCuentaExistente = z.object({
  tipo: z.literal('EXISTENTE'),
  usuarioId: z.uuid('Seleccione el usuario.'),
});

export const esquemaAltaTrabajador = esquemaFichaTrabajador.extend({
  cuenta: z.discriminatedUnion('tipo', [esquemaCuentaNueva, esquemaCuentaExistente]),
});

export const esquemaCeseTrabajador = z.object({
  fechaCese: z.iso.date('Ingrese la fecha de cese.'),
  motivo: z.string().trim().min(5, 'Describa el motivo en al menos 5 caracteres.').max(500),
  reasignarAId: z.uuid().nullable(),
});

export const esquemaReactivacionTrabajador = z.object({
  motivo: z.string().trim().min(5, 'Describa el motivo en al menos 5 caracteres.').max(500),
});

export const esquemaTrabajadorResumen = z.object({
  id: z.uuid(),
  usuarioId: z.uuid(),
  nombres: z.string(),
  apellidos: z.string(),
  dni: z.string(),
  correo: z.string(),
  cargo: esquemaReferenciaCatalogo,
  area: esquemaReferenciaCatalogo,
  estado: esquemaEstadoTrabajador,
  fechaIncorporacion: z.iso.date(),
});

export const esquemaTrabajadorDetalle = esquemaTrabajadorResumen.extend({
  tipoVinculo: esquemaReferenciaCatalogo,
  horario: z.string().nullable(),
  telefono: z.string().nullable(),
  funciones: z.string().nullable(),
  supervisor: z.object({ id: z.uuid(), nombre: z.string() }).nullable(),
  fechaCese: z.iso.date().nullable(),
  roles: z.array(esquemaRolReferencia),
  clientesAsignados: z.number().int().nonnegative(),
  tareasAbiertas: z.number().int().nonnegative(),
});

export const esquemaUsuarioSinFicha = z.object({
  id: z.uuid(),
  nombre: z.string(),
  correo: z.string(),
});

export type EstadoTrabajador = z.infer<typeof esquemaEstadoTrabajador>;
export type FichaTrabajador = z.infer<typeof esquemaFichaTrabajador>;
export type AltaTrabajador = z.infer<typeof esquemaAltaTrabajador>;
export type CeseTrabajador = z.infer<typeof esquemaCeseTrabajador>;
export type ReactivacionTrabajador = z.infer<typeof esquemaReactivacionTrabajador>;
export type TrabajadorResumen = z.infer<typeof esquemaTrabajadorResumen>;
export type TrabajadorDetalle = z.infer<typeof esquemaTrabajadorDetalle>;
export type UsuarioSinFicha = z.infer<typeof esquemaUsuarioSinFicha>;
