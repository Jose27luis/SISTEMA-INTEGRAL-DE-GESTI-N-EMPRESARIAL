import { z } from 'zod';
import { esquemaEstadoObligacion } from './obligations';

export const ESTADOS_INCIDENCIA = ['ABIERTA', 'EN_ATENCION', 'RESUELTA', 'ANULADA'] as const;

export const esquemaEstadoIncidencia = z.enum(ESTADOS_INCIDENCIA);

export type EstadoIncidencia = z.infer<typeof esquemaEstadoIncidencia>;

export const ETIQUETAS_ESTADO_INCIDENCIA: Record<EstadoIncidencia, string> = {
  ABIERTA: 'Abierta',
  EN_ATENCION: 'En atención',
  RESUELTA: 'Resuelta',
  ANULADA: 'Anulada',
};

export const esquemaIncidenciaEntrada = z.object({
  titulo: z.string().trim().min(3, 'Ingrese un título.').max(150),
  descripcion: z.string().trim().min(5, 'Describa la incidencia.').max(3000),
  fecha: z.iso.date('Ingrese la fecha.'),
  responsableId: z.uuid('Seleccione al responsable.'),
});

export type IncidenciaEntrada = z.infer<typeof esquemaIncidenciaEntrada>;

export const esquemaCambioIncidencia = z
  .object({
    estado: esquemaEstadoIncidencia,
    comentario: z
      .string()
      .trim()
      .max(2000)
      .transform((valor) => (valor === '' ? null : valor))
      .nullable(),
  })
  .superRefine((cambio, contexto) => {
    if ((cambio.estado === 'RESUELTA' || cambio.estado === 'ANULADA') && (cambio.comentario === null || cambio.comentario.length < 5)) {
      contexto.addIssue({
        code: 'custom',
        path: ['comentario'],
        message: cambio.estado === 'RESUELTA' ? 'Describa cómo se resolvió.' : 'Indique el motivo de la anulación.',
      });
    }
  });

export type CambioIncidencia = z.infer<typeof esquemaCambioIncidencia>;

const esquemaPersona = z.object({ id: z.uuid(), nombre: z.string() });

export const esquemaIncidencia = z.object({
  id: z.uuid(),
  titulo: z.string(),
  descripcion: z.string(),
  fecha: z.iso.date(),
  responsable: esquemaPersona,
  estado: esquemaEstadoIncidencia,
  resolucion: z.string().nullable(),
  resueltaEn: z.iso.datetime().nullable(),
  registradaPor: z.string(),
  registradaEn: z.iso.datetime(),
});

export type Incidencia = z.infer<typeof esquemaIncidencia>;

export const esquemaFichaOperativa = z.object({
  clienteId: z.uuid(),
  obligaciones: z.array(
    z.object({
      tipo: z.string(),
      responsable: z.string(),
      ultimoPeriodo: z.string().nullable(),
      estado: esquemaEstadoObligacion.nullable(),
      vencida: z.boolean(),
    }),
  ),
  documentacion: z.object({ recibida: z.number().int(), pendiente: z.number().int(), atrasada: z.number().int() }),
  actividades: z.array(
    z.object({
      tareaId: z.uuid(),
      codigo: z.string(),
      titulo: z.string(),
      responsable: z.string(),
      completadaEn: z.iso.datetime(),
    }),
  ),
  tareasAbiertas: z.number().int().nonnegative(),
  incidencias: z.array(esquemaIncidencia),
  puedeGestionarIncidencias: z.boolean(),
});

export type FichaOperativa = z.infer<typeof esquemaFichaOperativa>;
