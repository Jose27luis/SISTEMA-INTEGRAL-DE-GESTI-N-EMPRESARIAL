import { z } from 'zod';
import type { Prioridad } from './tasks';
import { ESTADOS_CERRADOS, esquemaHoraOpcional, type EstadoTarea, vencioPlazo } from './task-states';

export const HORAS_PARA_ACUSE = 24;

export const DIAS_HABILES_SIN_REPORTE: Record<Prioridad, number> = {
  URGENTE: 1,
  ALTA: 2,
  MEDIA: 3,
  BAJA: 5,
};

export const DIAS_POR_VENCER = 2;

export const SEMAFOROS = ['A_TIEMPO', 'POR_VENCER', 'VENCIDA', 'CERRADA'] as const;
export const esquemaSemaforo = z.enum(SEMAFOROS);
export type Semaforo = z.infer<typeof esquemaSemaforo>;
export const ETIQUETAS_SEMAFORO: Record<Semaforo, string> = {
  A_TIEMPO: 'A tiempo',
  POR_VENCER: 'Por vencer',
  VENCIDA: 'Vencida',
  CERRADA: 'Cerrada',
};

const MS_POR_DIA = 86_400_000;

function aDia(iso: string): number {
  return Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / MS_POR_DIA);
}

function esHabil(dia: number): boolean {
  const semana = new Date(dia * MS_POR_DIA).getUTCDay();
  return semana !== 0 && semana !== 6;
}

export function diasHabilesEntre(desde: string, hasta: string): number {
  let contador = 0;

  for (let dia = aDia(desde) + 1; dia <= aDia(hasta); dia += 1) {
    if (esHabil(dia)) {
      contador += 1;
    }
  }

  return contador;
}

export function sumarDiasHabiles(desde: string, dias: number): string {
  let dia = aDia(desde);
  let restantes = dias;

  while (restantes > 0) {
    dia += 1;

    if (esHabil(dia)) {
      restantes -= 1;
    }
  }

  return new Date(dia * MS_POR_DIA).toISOString().slice(0, 10);
}

export function semaforoTarea(
  estado: EstadoTarea,
  fechaLimite: string,
  hoy: string,
  horaLimite: string | null = null,
  horaActual: string | null = null,
): Semaforo {
  if (ESTADOS_CERRADOS.includes(estado)) {
    return 'CERRADA';
  }

  if (vencioPlazo(fechaLimite, hoy, horaLimite, horaActual)) {
    return 'VENCIDA';
  }

  return aDia(fechaLimite) - aDia(hoy) <= DIAS_POR_VENCER ? 'POR_VENCER' : 'A_TIEMPO';
}

export const ESTADOS_ESPERA_REPORTE: readonly EstadoTarea[] = ['PENDIENTE', 'EN_PROCESO', 'OBSERVADA', 'CORREGIDA'];

export function limiteDeReporte(prioridad: Prioridad, ultimoReporte: string): string {
  return sumarDiasHabiles(ultimoReporte, DIAS_HABILES_SIN_REPORTE[prioridad]);
}

export const ETAPAS_SEGUIMIENTO = ['ASIGNADA', 'RECIBIDA', 'EN_PROCESO', 'EN_REVISION', 'APROBADA', 'FINALIZADA'] as const;
export const esquemaEtapaSeguimiento = z.enum(ETAPAS_SEGUIMIENTO);
export type EtapaSeguimiento = z.infer<typeof esquemaEtapaSeguimiento>;
export const ETIQUETAS_ETAPA_SEGUIMIENTO: Record<EtapaSeguimiento, string> = {
  ASIGNADA: 'Asignada',
  RECIBIDA: 'Recibida',
  EN_PROCESO: 'En proceso',
  EN_REVISION: 'En revisión',
  APROBADA: 'Aprobada',
  FINALIZADA: 'Finalizada',
};

export const esquemaPasoSeguimiento = z.object({
  etapa: esquemaEtapaSeguimiento,
  situacion: z.enum(['HECHA', 'ACTUAL', 'PENDIENTE', 'OMITIDA']),
  fecha: z.iso.datetime().nullable(),
  usuario: z.string().nullable(),
  minutosEnEtapa: z.number().int().nonnegative().nullable(),
});
export type PasoSeguimiento = z.infer<typeof esquemaPasoSeguimiento>;

export const ESTADOS_PRORROGA = ['PENDIENTE', 'APROBADA', 'RECHAZADA'] as const;
export const esquemaEstadoProrroga = z.enum(ESTADOS_PRORROGA);
export type EstadoProrroga = z.infer<typeof esquemaEstadoProrroga>;
export const ETIQUETAS_ESTADO_PRORROGA: Record<EstadoProrroga, string> = {
  PENDIENTE: 'Por decidir',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
};

export const esquemaProrrogaEntrada = z.object({
  fechaPropuesta: z.iso.date('Elija la nueva fecha límite.'),
  horaPropuesta: esquemaHoraOpcional,
  motivo: z.string().trim().min(10, 'Explique el motivo con al menos 10 caracteres.').max(1000),
});
export type ProrrogaEntrada = z.infer<typeof esquemaProrrogaEntrada>;

export const esquemaResolucionProrroga = z
  .object({
    decision: z.enum(['APROBAR', 'RECHAZAR']),
    respuesta: z
      .string()
      .trim()
      .max(1000)
      .transform((valor) => (valor === '' ? null : valor))
      .nullable(),
  })
  .superRefine((resolucion, contexto) => {
    if (resolucion.decision === 'RECHAZAR' && (resolucion.respuesta ?? '').length < 5) {
      contexto.addIssue({ code: 'custom', path: ['respuesta'], message: 'Explique por qué se rechaza.' });
    }
  });
export type ResolucionProrroga = z.infer<typeof esquemaResolucionProrroga>;

export const esquemaProrroga = z.object({
  id: z.uuid(),
  fechaAnterior: z.iso.date(),
  horaAnterior: z.string().nullable(),
  fechaPropuesta: z.iso.date(),
  horaPropuesta: z.string().nullable(),
  motivo: z.string(),
  estado: esquemaEstadoProrroga,
  solicitadaPor: z.string(),
  solicitadaEn: z.iso.datetime(),
  resueltaPor: z.string().nullable(),
  resueltaEn: z.iso.datetime().nullable(),
  respuesta: z.string().nullable(),
});
export type Prorroga = z.infer<typeof esquemaProrroga>;

export const esquemaSeguimientoTarea = z.object({
  estricto: z.boolean(),
  semaforo: esquemaSemaforo,
  recibidaEn: z.iso.datetime().nullable(),
  esperandoAcuse: z.boolean(),
  sinAcuse: z.boolean(),
  ultimoReporte: z.iso.datetime().nullable(),
  limiteReporte: z.iso.date().nullable(),
  sinReporte: z.boolean(),
  rondasObservadas: z.number().int().nonnegative(),
  pasos: z.array(esquemaPasoSeguimiento),
  prorrogas: z.array(esquemaProrroga),
  acciones: z.object({
    acusar: z.boolean(),
    solicitarProrroga: z.boolean(),
    resolverProrroga: z.boolean(),
  }),
  requisitosEnvio: z.array(z.object({ texto: z.string(), cumplido: z.boolean() })),
});
export type SeguimientoTarea = z.infer<typeof esquemaSeguimientoTarea>;
