import type { Prisma } from '@prisma/client';
import { estaAtrasada, type TareaResumen } from '@sige/types';
import { aFechaIso, aFechaIsoONula } from '../../common/dates';

export const INCLUSION_RESUMEN_TAREA = {
  cliente: { select: { id: true, razonSocial: true } },
  responsable: { select: { id: true, nombre: true } },
} satisfies Prisma.TareaInclude;

export type TareaConResumen = Prisma.TareaGetPayload<{ include: typeof INCLUSION_RESUMEN_TAREA }>;

export function aResumenTarea(tarea: TareaConResumen, hoy: string): TareaResumen {
  const fechaLimite = aFechaIso(tarea.fechaLimite);

  return {
    id: tarea.id,
    codigo: tarea.codigo,
    titulo: tarea.titulo,
    estado: tarea.estado,
    prioridad: tarea.prioridad,
    fechaInicio: aFechaIsoONula(tarea.fechaInicio),
    fechaLimite,
    cliente: tarea.cliente === null ? null : { id: tarea.cliente.id, nombre: tarea.cliente.razonSocial },
    responsable: tarea.responsable,
    porcentajeAvance: tarea.porcentajeAvance,
    atrasada: estaAtrasada(tarea.estado, fechaLimite, hoy),
  };
}
