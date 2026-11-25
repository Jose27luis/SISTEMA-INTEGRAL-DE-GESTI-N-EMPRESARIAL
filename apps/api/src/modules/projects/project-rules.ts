import { ESTADOS_PROYECTO_CERRADOS, type EstadoProyecto, type EstadoTarea, TRANSICIONES_PROYECTO } from '@sige/types';

export interface AvanceTarea {
  estado: EstadoTarea;
  porcentajeAvance: number;
}

export function avanceDeTareas(tareas: readonly AvanceTarea[]): number {
  const vigentes = tareas.filter(({ estado }) => estado !== 'CANCELADA');

  if (vigentes.length === 0) {
    return 0;
  }

  const suma = vigentes.reduce(
    (total, { estado, porcentajeAvance }) => total + (estado === 'APROBADA' || estado === 'FINALIZADA' ? 100 : porcentajeAvance),
    0,
  );

  return Math.round(suma / vigentes.length);
}

export function proyectoAtrasado(estado: EstadoProyecto, fechaEntrega: string, hoy: string): boolean {
  return !ESTADOS_PROYECTO_CERRADOS.includes(estado) && fechaEntrega < hoy;
}

export function transicionPermitida(desde: EstadoProyecto, hacia: EstadoProyecto): boolean {
  return TRANSICIONES_PROYECTO[desde].includes(hacia);
}

export function formatearCodigoProyecto(anio: number, numero: bigint): string {
  return `P-${String(anio)}-${numero.toString().padStart(4, '0')}`;
}
