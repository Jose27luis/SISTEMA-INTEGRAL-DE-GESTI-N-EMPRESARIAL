import type { Prisma } from '@prisma/client';
import { estaAtrasada, type TareaResumen } from '@sige/types';
import { aFechaIso, aFechaIsoONula, horaEnLima } from '../../common/dates';
import { evaluarSeguimiento } from './task-tracking-rules';

export const INCLUSION_RESUMEN_TAREA = {
  cliente: { select: { id: true, razonSocial: true } },
  responsable: { select: { id: true, nombre: true } },
} satisfies Prisma.TareaInclude;

export type TareaConResumen = Prisma.TareaGetPayload<{ include: typeof INCLUSION_RESUMEN_TAREA }>;

export function aResumenTarea(tarea: TareaConResumen, hoy: string, ahora: Date = new Date()): TareaResumen {
  const fechaLimite = aFechaIso(tarea.fechaLimite);
  const seguimiento = evaluarSeguimiento(
    {
      estado: tarea.estado,
      prioridad: tarea.prioridad,
      fechaLimite,
      horaLimite: tarea.horaLimite,
      estricto: tarea.seguimientoEstricto,
      creadoEn: tarea.creadoEn,
      recibidaEn: tarea.recibidaEn,
      ultimoReporteEn: tarea.ultimoReporteEn,
    },
    ahora,
    hoy,
  );

  return {
    id: tarea.id,
    codigo: tarea.codigo,
    titulo: tarea.titulo,
    estado: tarea.estado,
    prioridad: tarea.prioridad,
    fechaInicio: aFechaIsoONula(tarea.fechaInicio),
    horaInicio: tarea.horaInicio,
    fechaLimite,
    horaLimite: tarea.horaLimite,
    cliente: tarea.cliente === null ? null : { id: tarea.cliente.id, nombre: tarea.cliente.razonSocial },
    responsable: tarea.responsable,
    porcentajeAvance: tarea.porcentajeAvance,
    atrasada: estaAtrasada(tarea.estado, fechaLimite, hoy, tarea.horaLimite, horaEnLima(ahora)),
    semaforo: seguimiento.semaforo,
    esperandoAcuse: seguimiento.esperandoAcuse,
    sinAcuse: seguimiento.sinAcuse,
    sinReporte: seguimiento.sinReporte,
  };
}
