import { z } from 'zod';
import { esquemaReferenciaCatalogo } from './catalogs';
import { esquemaMetadatosPagina } from './common';
import { esDniValido, esRucValido } from './identity-documents';

export const TIPOS_PERSONA = ['NATURAL', 'JURIDICA'] as const;
export const ESTADOS_CLIENTE = ['ACTIVO', 'SUSPENDIDO', 'INACTIVO'] as const;
export const ROLES_EN_CLIENTE = ['RESPONSABLE', 'APOYO', 'REVISOR', 'CONSULTA'] as const;

export const esquemaTipoPersona = z.enum(TIPOS_PERSONA);
export const esquemaEstadoCliente = z.enum(ESTADOS_CLIENTE);
export const esquemaRolEnCliente = z.enum(ROLES_EN_CLIENTE);

export type TipoPersona = z.infer<typeof esquemaTipoPersona>;
export type EstadoCliente = z.infer<typeof esquemaEstadoCliente>;
export type RolEnCliente = z.infer<typeof esquemaRolEnCliente>;

export const ETIQUETAS_TIPO_PERSONA: Record<TipoPersona, string> = {
  NATURAL: 'Persona natural',
  JURIDICA: 'Persona jurídica',
};

export const ETIQUETAS_ESTADO_CLIENTE: Record<EstadoCliente, string> = {
  ACTIVO: 'Activo',
  SUSPENDIDO: 'Suspendido',
  INACTIVO: 'Inactivo',
};

export const ETIQUETAS_ROL_EN_CLIENTE: Record<RolEnCliente, string> = {
  RESPONSABLE: 'Responsable',
  APOYO: 'Apoyo',
  REVISOR: 'Revisor',
  CONSULTA: 'Consulta',
};

const textoOpcional = (maximo: number) =>
  z
    .string()
    .trim()
    .max(maximo, `Máximo ${String(maximo)} caracteres.`)
    .transform((valor) => (valor === '' ? null : valor))
    .nullable();

const documentoOpcional = z
  .string()
  .trim()
  .transform((valor) => (valor === '' ? null : valor))
  .nullable();

export const esquemaClienteEntrada = z
  .object({
    tipoPersona: esquemaTipoPersona,
    razonSocial: z.string().trim().min(2, 'Ingrese la razón social o los nombres.').max(200),
    ruc: documentoOpcional,
    dni: documentoOpcional,
    domicilioFiscal: textoOpcional(250),
    representanteLegal: textoOpcional(150),
    actividadEconomica: textoOpcional(200),
    regimenTributarioId: z.uuid().nullable(),
    fechaIncorporacion: z.iso.date('Ingrese la fecha de incorporación.'),
    responsableId: z.uuid().nullable(),
  })
  .superRefine((cliente, contexto) => {
    if (cliente.ruc === null && cliente.dni === null) {
      contexto.addIssue({ code: 'custom', path: ['ruc'], message: 'Ingrese el RUC o el DNI.' });
    }

    if (cliente.ruc !== null && !esRucValido(cliente.ruc)) {
      contexto.addIssue({
        code: 'custom',
        path: ['ruc'],
        message: 'El RUC no es válido: revise los 11 dígitos.',
      });
    }

    if (cliente.dni !== null && !esDniValido(cliente.dni)) {
      contexto.addIssue({ code: 'custom', path: ['dni'], message: 'El DNI debe tener 8 dígitos.' });
    }

    if (cliente.tipoPersona === 'JURIDICA' && cliente.ruc === null) {
      contexto.addIssue({
        code: 'custom',
        path: ['ruc'],
        message: 'Una persona jurídica debe tener RUC.',
      });
    }
  });

export const esquemaCambioEstadoCliente = z.object({
  estado: esquemaEstadoCliente,
  motivo: z.string().trim().min(5, 'Describa el motivo en al menos 5 caracteres.').max(500),
});

export const esquemaContactoEntrada = z.object({
  nombre: z.string().trim().min(2, 'Ingrese el nombre.').max(120),
  cargo: textoOpcional(80),
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .transform((valor) => (valor === '' ? null : valor))
    .pipe(z.email('Ingrese un correo válido.').nullable())
    .nullable(),
  telefono: textoOpcional(30),
  principal: z.boolean(),
});

export const esquemaContacto = z.object({
  id: z.uuid(),
  nombre: z.string(),
  cargo: z.string().nullable(),
  correo: z.string().nullable(),
  telefono: z.string().nullable(),
  principal: z.boolean(),
  activo: z.boolean(),
});

export const esquemaAsignacionEntrada = z.object({
  usuarioId: z.uuid('Seleccione un usuario.'),
  rolEnCliente: esquemaRolEnCliente,
});

export const esquemaAsignacion = z.object({
  id: z.uuid(),
  usuario: z.object({ id: z.uuid(), nombre: z.string(), correo: z.string() }),
  rolEnCliente: esquemaRolEnCliente,
  asignadoEn: z.iso.datetime(),
});

export const esquemaClienteResumen = z.object({
  id: z.uuid(),
  tipoPersona: esquemaTipoPersona,
  razonSocial: z.string(),
  ruc: z.string().nullable(),
  dni: z.string().nullable(),
  estado: esquemaEstadoCliente,
  regimenTributario: esquemaReferenciaCatalogo.nullable(),
  responsable: z.object({ id: z.uuid(), nombre: z.string() }).nullable(),
  contactoPrincipal: z.string().nullable(),
});

export const esquemaClienteDetalle = esquemaClienteResumen.extend({
  domicilioFiscal: z.string().nullable(),
  representanteLegal: z.string().nullable(),
  actividadEconomica: z.string().nullable(),
  fechaIncorporacion: z.iso.date(),
  creadoEn: z.iso.datetime(),
  contactos: z.array(esquemaContacto),
  asignaciones: z.array(esquemaAsignacion),
  puedeGestionar: z.boolean(),
  puedeAsignar: z.boolean(),
});

const textoFiltro = z
  .string()
  .trim()
  .max(100)
  .transform((valor) => (valor === '' ? undefined : valor))
  .optional();

export const esquemaFiltroClientes = z.object({
  busqueda: textoFiltro,
  estado: z
    .string()
    .trim()
    .transform((valor) => (valor === '' ? undefined : valor))
    .pipe(esquemaEstadoCliente.optional())
    .optional(),
  pagina: z.coerce.number().int().positive().max(100000).default(1),
});

export const esquemaPaginaClientes = esquemaMetadatosPagina.extend({
  elementos: z.array(esquemaClienteResumen),
});

export const esquemaFilaRechazada = z.object({
  fila: z.number().int().positive(),
  documento: z.string().nullable(),
  errores: z.array(z.string()),
});

export const esquemaResultadoImportacion = z.object({
  filasLeidas: z.number().int().nonnegative(),
  creados: z.number().int().nonnegative(),
  rechazadas: z.array(esquemaFilaRechazada),
});

export const esquemaRegistroHistorial = z.object({
  id: z.string(),
  fecha: z.iso.datetime(),
  usuario: z.string().nullable(),
  accion: z.string(),
  entidad: z.string(),
  motivo: z.string().nullable(),
  despues: z.json().nullable(),
});

export type ClienteEntrada = z.infer<typeof esquemaClienteEntrada>;
export type CambioEstadoCliente = z.infer<typeof esquemaCambioEstadoCliente>;
export type ContactoEntrada = z.infer<typeof esquemaContactoEntrada>;
export type Contacto = z.infer<typeof esquemaContacto>;
export type AsignacionEntrada = z.infer<typeof esquemaAsignacionEntrada>;
export type Asignacion = z.infer<typeof esquemaAsignacion>;
export type ClienteResumen = z.infer<typeof esquemaClienteResumen>;
export type ClienteDetalle = z.infer<typeof esquemaClienteDetalle>;
export type FiltroClientes = z.infer<typeof esquemaFiltroClientes>;
export type PaginaClientes = z.infer<typeof esquemaPaginaClientes>;
export type FilaRechazada = z.infer<typeof esquemaFilaRechazada>;
export type ResultadoImportacion = z.infer<typeof esquemaResultadoImportacion>;
export type RegistroHistorial = z.infer<typeof esquemaRegistroHistorial>;
