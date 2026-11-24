import type { EstadoCobranza, TramoAntiguedad } from '@sige/types';

const MS_POR_DIA = 86_400_000;

export function aCentimos(monto: number): number {
  return Math.round(monto * 100);
}

export function deCentimos(centimos: number): number {
  return centimos / 100;
}

export function sumarMontos(montos: readonly number[]): number {
  return deCentimos(montos.reduce((total, monto) => total + aCentimos(monto), 0));
}

export function restarMontos(minuendo: number, sustraendo: number): number {
  return deCentimos(aCentimos(minuendo) - aCentimos(sustraendo));
}

export function estadoCobranza(monto: number, pagado: number, anulado: boolean): EstadoCobranza {
  if (anulado) {
    return 'ANULADO';
  }

  if (aCentimos(pagado) >= aCentimos(monto)) {
    return 'PAGADO';
  }

  return aCentimos(pagado) > 0 ? 'PARCIAL' : 'PENDIENTE';
}

export function diasDeAtraso(fechaVencimiento: string, hoy: string, saldo: number, anulado: boolean): number {
  if (anulado || aCentimos(saldo) <= 0 || fechaVencimiento >= hoy) {
    return 0;
  }

  return Math.round((Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${fechaVencimiento}T00:00:00Z`)) / MS_POR_DIA);
}

export function tramoDeAntiguedad(diasVencido: number): TramoAntiguedad {
  if (diasVencido <= 0) {
    return 'POR_VENCER';
  }

  if (diasVencido <= 30) {
    return 'D0_30';
  }

  if (diasVencido <= 60) {
    return 'D31_60';
  }

  return diasVencido <= 90 ? 'D61_90' : 'D90_MAS';
}

export function mesesEntre(desde: string, hasta: string): string[] {
  const [anioDesde, mesDesde] = desde.split('-').map(Number);
  const [anioHasta, mesHasta] = hasta.split('-').map(Number);
  const inicio = (anioDesde ?? 0) * 12 + (mesDesde ?? 1) - 1;
  const fin = (anioHasta ?? 0) * 12 + (mesHasta ?? 1) - 1;
  const meses: string[] = [];

  for (let indice = inicio; indice <= fin; indice += 1) {
    meses.push(`${String(Math.floor(indice / 12))}-${String((indice % 12) + 1).padStart(2, '0')}`);
  }

  return meses;
}

export function desplazarPeriodo(periodo: string, meses: number): string {
  const [anio, mes] = periodo.split('-').map(Number);
  const indice = (anio ?? 0) * 12 + (mes ?? 1) - 1 + meses;
  return `${String(Math.floor(indice / 12))}-${String((indice % 12) + 1).padStart(2, '0')}`;
}

export function fechaDelPeriodo(periodo: string, dia: number): string {
  const [anio, mes] = periodo.split('-').map(Number);
  const ultimo = new Date(Date.UTC(anio ?? 2000, mes ?? 1, 0)).getUTCDate();
  return `${periodo}-${String(Math.min(dia, ultimo)).padStart(2, '0')}`;
}

export function ultimoDiaDelPeriodo(periodo: string): string {
  return fechaDelPeriodo(periodo, 31);
}

export function aplicaServicioEnPeriodo(periodo: string, desde: string, hasta: string | null): boolean {
  return desde.slice(0, 7) <= periodo && (hasta === null || hasta.slice(0, 7) >= periodo);
}
