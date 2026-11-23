const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatearFechaHora(iso: string | null): string {
  return iso === null ? 'Nunca' : FORMATO_FECHA_HORA.format(new Date(iso));
}

export function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-');
  return `${dia ?? ''}/${mes ?? ''}/${anio ?? ''}`;
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

const NAVEGADORES: readonly [RegExp, string][] = [
  [/Edg\//u, 'Edge'],
  [/OPR\//u, 'Opera'],
  [/Firefox\//u, 'Firefox'],
  [/Chrome\//u, 'Chrome'],
  [/Safari\//u, 'Safari'],
];

const SISTEMAS: readonly [RegExp, string][] = [
  [/Android/u, 'Android'],
  [/iPhone|iPad/u, 'iOS'],
  [/Windows/u, 'Windows'],
  [/Mac OS X/u, 'macOS'],
  [/Linux/u, 'Linux'],
];

export function describirDispositivo(agente: string | null): string {
  if (agente === null) {
    return 'Dispositivo desconocido';
  }

  const navegador = NAVEGADORES.find(([patron]) => patron.test(agente))?.[1];
  const sistema = SISTEMAS.find(([patron]) => patron.test(agente))?.[1];

  if (navegador === undefined && sistema === undefined) {
    return agente.slice(0, 60);
  }

  return [navegador, sistema].filter((parte) => parte !== undefined).join(' en ');
}

export function formatearMinutos(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;

  if (horas === 0) {
    return `${String(resto)} min`;
  }

  return resto === 0 ? `${String(horas)} h` : `${String(horas)} h ${String(resto)} min`;
}

export function formatearTamano(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${String(Math.max(1, Math.round(bytes / 1024)))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
