import type { EstadoObligacion, EstadoTarea } from '@sige/types';

const MS_POR_DIA = 86_400_000;

function partesPeriodo(periodo: string): { anio: number; mes: number } {
  const [anio, mes] = periodo.split('-').map(Number);

  if (anio === undefined || mes === undefined || Number.isNaN(anio) || Number.isNaN(mes)) {
    throw new Error(`Periodo no válido: ${periodo}`);
  }

  return { anio, mes };
}

function aPeriodo(fecha: Date): string {
  return fecha.toISOString().slice(0, 7);
}

export function desplazarPeriodo(periodo: string, meses: number): string {
  const { anio, mes } = partesPeriodo(periodo);
  return aPeriodo(new Date(Date.UTC(anio, mes - 1 + meses, 1)));
}

export function periodoDeFecha(fecha: string): string {
  return fecha.slice(0, 7);
}

export function periodoAGenerar(hoy: string): string {
  return desplazarPeriodo(periodoDeFecha(hoy), -1);
}

export function vencimientoPorDia(periodo: string, dia: number): string {
  const { anio, mes } = partesPeriodo(periodo);
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(anio, mes, Math.min(dia, ultimoDia))).toISOString().slice(0, 10);
}

export function ultimoDigitoRuc(ruc: string | null): number | null {
  if (ruc === null || !/^\d{11}$/u.test(ruc)) {
    return null;
  }

  return Number(ruc.slice(-1));
}

export function aplicaEnPeriodo(periodo: string, desde: string, hasta: string | null): boolean {
  return desde <= periodo && (hasta === null || periodo <= hasta);
}

export function estadoObligacion(estadoTarea: EstadoTarea, presentada: boolean): EstadoObligacion {
  switch (estadoTarea) {
    case 'CANCELADA':
      return 'ANULADA';
    case 'APROBADA':
    case 'FINALIZADA':
      return 'CUMPLIDA';
    case 'OBSERVADA':
    case 'CORREGIDA':
      return 'OBSERVADA';
    case 'EN_REVISION':
      return 'PRESENTADA';
    case 'EN_PROCESO':
      return presentada ? 'PRESENTADA' : 'EN_PROCESO';
    case 'PENDIENTE':
      return presentada ? 'PRESENTADA' : 'PENDIENTE';
  }
}

const ESTADOS_SIN_PRESENTAR: readonly EstadoObligacion[] = ['PENDIENTE', 'EN_PROCESO', 'OBSERVADA'];

export function estaVencida(estado: EstadoObligacion, fechaVencimiento: string, hoy: string): boolean {
  return ESTADOS_SIN_PRESENTAR.includes(estado) && fechaVencimiento < hoy;
}

export function diasHasta(fecha: string, hoy: string): number {
  return Math.round((Date.parse(`${fecha}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / MS_POR_DIA);
}

export type TipoAlertaObligacion = 'OBLIGACION_POR_VENCER' | 'OBLIGACION_VENCIDA';

export function clasificarAlertaObligacion(
  fechaVencimiento: string,
  hoy: string,
  diasAlerta: readonly number[],
): TipoAlertaObligacion | null {
  const dias = diasHasta(fechaVencimiento, hoy);

  if (dias < 0) {
    return 'OBLIGACION_VENCIDA';
  }

  return diasAlerta.includes(dias) ? 'OBLIGACION_POR_VENCER' : null;
}

export function claveAlertaObligacion(
  tipo: TipoAlertaObligacion,
  obligacionId: string,
  fechaVencimiento: string,
  hoy: string,
  usuarioId: string,
): string {
  const momento = tipo === 'OBLIGACION_VENCIDA' ? `vencio-${fechaVencimiento}` : `vence-${fechaVencimiento}-aviso-${hoy}`;
  return `${tipo}:${obligacionId}:${momento}:${usuarioId}`;
}
