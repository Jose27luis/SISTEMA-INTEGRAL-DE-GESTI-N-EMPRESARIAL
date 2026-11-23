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

export function sumarMinutos(fecha: Date, minutos: number): Date {
  return new Date(fecha.getTime() + minutos * 60_000);
}
