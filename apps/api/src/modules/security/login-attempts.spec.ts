import { describe, expect, it } from 'vitest';
import {
  type EstadoIntentos,
  estaBloqueado,
  MAXIMO_INTENTOS_FALLIDOS,
  MINUTOS_BLOQUEO,
  registrarIntentoFallido,
} from './login-attempts';

const ahora = new Date('2026-11-23T15:00:00.000Z');

describe('intentos de ingreso', () => {
  it('cuenta los intentos fallidos sin bloquear antes del límite', () => {
    let estado: EstadoIntentos = { intentosFallidos: 0, bloqueadoHasta: null };

    for (let intento = 1; intento < MAXIMO_INTENTOS_FALLIDOS; intento += 1) {
      estado = registrarIntentoFallido(estado, ahora);
      expect(estado).toEqual({ intentosFallidos: intento, bloqueadoHasta: null });
    }
  });

  it('bloquea 15 minutos al alcanzar el quinto intento y reinicia el contador', () => {
    const estado = registrarIntentoFallido({ intentosFallidos: 4, bloqueadoHasta: null }, ahora);

    expect(estado.intentosFallidos).toBe(0);
    expect(estado.bloqueadoHasta?.getTime()).toBe(ahora.getTime() + MINUTOS_BLOQUEO * 60_000);
    expect(estaBloqueado(estado, ahora)).toBe(true);
  });

  it('libera la cuenta cuando vence el bloqueo', () => {
    const estado = { intentosFallidos: 0, bloqueadoHasta: new Date(ahora.getTime() - 1) };

    expect(estaBloqueado(estado, ahora)).toBe(false);
  });
});
