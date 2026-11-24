import type { Frecuencia } from '@sige/types';

export interface ReglaFechas {
  frecuencia: Frecuencia;
  diaDelMes: number | null;
  diaDeSemana: number | null;
  vigenteDesde: string;
  vigenteHasta: string | null;
}

export const DIAS_DE_RECUPERACION = 7;

function aFecha(texto: string): Date {
  return new Date(`${texto}T00:00:00Z`);
}

function aTexto(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function sumarDias(fecha: string, dias: number): string {
  const resultado = aFecha(fecha);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return aTexto(resultado);
}

export function diaIsoDeSemana(fecha: string): number {
  const dia = aFecha(fecha).getUTCDay();
  return dia === 0 ? 7 : dia;
}

export function correspondeEnFecha(regla: ReglaFechas, fecha: string): boolean {
  if (fecha < regla.vigenteDesde || (regla.vigenteHasta !== null && fecha > regla.vigenteHasta)) {
    return false;
  }

  if (regla.frecuencia === 'MENSUAL') {
    return regla.diaDelMes !== null && Number(fecha.slice(8, 10)) === regla.diaDelMes;
  }

  return regla.diaDeSemana !== null && diaIsoDeSemana(fecha) === regla.diaDeSemana;
}

export function ocurrenciasEntre(regla: ReglaFechas, desde: string, hasta: string): string[] {
  const fechas: string[] = [];

  for (let fecha = desde; fecha <= hasta; fecha = sumarDias(fecha, 1)) {
    if (correspondeEnFecha(regla, fecha)) {
      fechas.push(fecha);
    }
  }

  return fechas;
}

export function proximaOcurrencia(regla: ReglaFechas, desde: string): string | null {
  const inicio = desde < regla.vigenteDesde ? regla.vigenteDesde : desde;
  const limite = sumarDias(inicio, 62);

  for (let fecha = inicio; fecha <= limite; fecha = sumarDias(fecha, 1)) {
    if (regla.vigenteHasta !== null && fecha > regla.vigenteHasta) {
      return null;
    }

    if (correspondeEnFecha(regla, fecha)) {
      return fecha;
    }
  }

  return null;
}
