import { z } from 'zod';

export const ESTADOS_TAREA = [
  'PENDIENTE',
  'EN_PROCESO',
  'EN_REVISION',
  'OBSERVADA',
  'CORREGIDA',
  'APROBADA',
  'FINALIZADA',
  'CANCELADA',
] as const;

export const esquemaEstadoTarea = z.enum(ESTADOS_TAREA);

export type EstadoTarea = z.infer<typeof esquemaEstadoTarea>;

export const ETIQUETAS_ESTADO_TAREA: Record<EstadoTarea, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  EN_REVISION: 'En revisión',
  OBSERVADA: 'Observada',
  CORREGIDA: 'Corregida',
  APROBADA: 'Aprobada',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

export const ESTADOS_CERRADOS: readonly EstadoTarea[] = ['APROBADA', 'FINALIZADA', 'CANCELADA'];

export const ESTADOS_CON_AVANCE: readonly EstadoTarea[] = ['PENDIENTE', 'EN_PROCESO', 'OBSERVADA', 'CORREGIDA'];

export type AccionTarea =
  | 'INICIAR'
  | 'TERMINAR'
  | 'OBSERVAR'
  | 'CORREGIR'
  | 'REENVIAR'
  | 'APROBAR'
  | 'FINALIZAR'
  | 'CANCELAR';

const TRANSICIONES: Record<AccionTarea, { desde: readonly EstadoTarea[] }> = {
  INICIAR: { desde: ['PENDIENTE'] },
  TERMINAR: { desde: ['EN_PROCESO'] },
  OBSERVAR: { desde: ['EN_REVISION'] },
  CORREGIR: { desde: ['OBSERVADA'] },
  REENVIAR: { desde: ['CORREGIDA'] },
  APROBAR: { desde: ['EN_REVISION'] },
  FINALIZAR: { desde: ['APROBADA'] },
  CANCELAR: { desde: ['PENDIENTE', 'EN_PROCESO', 'OBSERVADA'] },
};

export function estadoTrasAccion(
  actual: EstadoTarea,
  accion: AccionTarea,
  requiereAprobacion: boolean,
): EstadoTarea | null {
  if (!TRANSICIONES[accion].desde.includes(actual)) {
    return null;
  }

  switch (accion) {
    case 'INICIAR':
      return 'EN_PROCESO';
    case 'TERMINAR':
      return requiereAprobacion ? 'EN_REVISION' : 'FINALIZADA';
    case 'OBSERVAR':
      return 'OBSERVADA';
    case 'CORREGIR':
      return 'CORREGIDA';
    case 'REENVIAR':
      return 'EN_REVISION';
    case 'APROBAR':
      return 'APROBADA';
    case 'FINALIZAR':
      return 'FINALIZADA';
    case 'CANCELAR':
      return 'CANCELADA';
  }
}

export function accionAlRegistrarAvance(actual: EstadoTarea): AccionTarea | null {
  if (actual === 'PENDIENTE') {
    return 'INICIAR';
  }

  return actual === 'OBSERVADA' ? 'CORREGIR' : null;
}

export function accionDeEnvio(actual: EstadoTarea): AccionTarea | null {
  if (actual === 'EN_PROCESO') {
    return 'TERMINAR';
  }

  return actual === 'CORREGIDA' ? 'REENVIAR' : null;
}

export function estaAtrasada(estado: EstadoTarea, fechaLimite: string, hoy: string): boolean {
  return !ESTADOS_CERRADOS.includes(estado) && fechaLimite < hoy;
}
