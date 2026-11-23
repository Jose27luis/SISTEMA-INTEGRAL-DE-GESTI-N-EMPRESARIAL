export const MAXIMO_INTENTOS_FALLIDOS = 5;
export const MINUTOS_BLOQUEO = 15;

export interface EstadoIntentos {
  intentosFallidos: number;
  bloqueadoHasta: Date | null;
}

export function estaBloqueado(estado: EstadoIntentos, ahora: Date): boolean {
  return estado.bloqueadoHasta !== null && estado.bloqueadoHasta.getTime() > ahora.getTime();
}

export function registrarIntentoFallido(estado: EstadoIntentos, ahora: Date): EstadoIntentos {
  const intentos = estado.intentosFallidos + 1;

  if (intentos >= MAXIMO_INTENTOS_FALLIDOS) {
    return {
      intentosFallidos: 0,
      bloqueadoHasta: new Date(ahora.getTime() + MINUTOS_BLOQUEO * 60_000),
    };
  }

  return { intentosFallidos: intentos, bloqueadoHasta: null };
}
