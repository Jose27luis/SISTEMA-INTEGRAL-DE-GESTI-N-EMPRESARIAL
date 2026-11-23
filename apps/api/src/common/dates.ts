const DESPLAZAMIENTO_LIMA = '-05:00';

export function aIso(fecha: Date): string {
  return fecha.toISOString();
}

export function aIsoONulo(fecha: Date | null): string | null {
  return fecha === null ? null : fecha.toISOString();
}

export function inicioDelDiaEnLima(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000${DESPLAZAMIENTO_LIMA}`);
}

export function finDelDiaEnLima(fecha: string): Date {
  return new Date(`${fecha}T23:59:59.999${DESPLAZAMIENTO_LIMA}`);
}

export function horaEnLima(fecha: Date): string {
  return fecha.toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

const FORMATO_FECHA_LIMA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Lima',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function fechaHoyEnLima(): string {
  return FORMATO_FECHA_LIMA.format(new Date());
}

export function aFechaDb(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

export function aFechaIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function aFechaIsoONula(fecha: Date | null): string | null {
  return fecha === null ? null : aFechaIso(fecha);
}

export function sumarMinutos(fecha: Date, minutos: number): Date {
  return new Date(fecha.getTime() + minutos * 60_000);
}
