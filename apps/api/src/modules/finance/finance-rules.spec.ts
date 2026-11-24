import { describe, expect, it } from 'vitest';
import {
  aplicaServicioEnPeriodo,
  desplazarPeriodo,
  diasDeAtraso,
  estadoCobranza,
  fechaDelPeriodo,
  mesesEntre,
  restarMontos,
  sumarMontos,
  tramoDeAntiguedad,
  ultimoDiaDelPeriodo,
} from './finance-rules';

describe('tramoDeAntiguedad', () => {
  it('clasifica el saldo por días de atraso', () => {
    expect(tramoDeAntiguedad(0)).toBe('POR_VENCER');
    expect(tramoDeAntiguedad(1)).toBe('D0_30');
    expect(tramoDeAntiguedad(30)).toBe('D0_30');
    expect(tramoDeAntiguedad(31)).toBe('D31_60');
    expect(tramoDeAntiguedad(90)).toBe('D61_90');
    expect(tramoDeAntiguedad(91)).toBe('D90_MAS');
  });
});

describe('meses', () => {
  it('recorre meses cruzando el año', () => {
    expect(mesesEntre('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(desplazarPeriodo('2027-01', -1)).toBe('2026-12');
    expect(desplazarPeriodo('2026-11', -11)).toBe('2025-12');
  });
});

describe('montos', () => {
  it('suma y resta sin errores de redondeo', () => {
    expect(sumarMontos([0.1, 0.2])).toBe(0.3);
    expect(sumarMontos([1500.15, 499.85, 0.01])).toBe(2000.01);
    expect(restarMontos(1000, 333.33)).toBe(666.67);
  });
});

describe('estadoCobranza', () => {
  it('se deriva del monto pagado', () => {
    expect(estadoCobranza(1000, 0, false)).toBe('PENDIENTE');
    expect(estadoCobranza(1000, 400, false)).toBe('PARCIAL');
    expect(estadoCobranza(1000, 1000, false)).toBe('PAGADO');
    expect(estadoCobranza(1000, 400, true)).toBe('ANULADO');
  });
});

describe('diasDeAtraso', () => {
  it('cuenta los días desde el vencimiento solo si hay saldo', () => {
    expect(diasDeAtraso('2026-11-01', '2026-11-24', 100, false)).toBe(23);
    expect(diasDeAtraso('2026-11-24', '2026-11-24', 100, false)).toBe(0);
    expect(diasDeAtraso('2026-11-01', '2026-11-24', 0, false)).toBe(0);
    expect(diasDeAtraso('2026-11-01', '2026-11-24', 100, true)).toBe(0);
  });
});

describe('periodos de honorarios', () => {
  it('ubica el día de pago dentro del mes, sin pasarse de su último día', () => {
    expect(fechaDelPeriodo('2026-11', 15)).toBe('2026-11-15');
    expect(fechaDelPeriodo('2027-02', 28)).toBe('2027-02-28');
    expect(ultimoDiaDelPeriodo('2027-02')).toBe('2027-02-28');
    expect(ultimoDiaDelPeriodo('2026-12')).toBe('2026-12-31');
  });

  it('aplica el servicio solo dentro de su vigencia por mes', () => {
    expect(aplicaServicioEnPeriodo('2026-11', '2026-11-20', null)).toBe(true);
    expect(aplicaServicioEnPeriodo('2026-10', '2026-11-20', null)).toBe(false);
    expect(aplicaServicioEnPeriodo('2026-12', '2026-01-01', '2026-11-30')).toBe(false);
  });
});
