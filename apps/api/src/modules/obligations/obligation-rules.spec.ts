import { describe, expect, it } from 'vitest';
import {
  aplicaEnPeriodo,
  claveAlertaObligacion,
  clasificarAlertaObligacion,
  desplazarPeriodo,
  estadoObligacion,
  estaVencida,
  periodoAGenerar,
  ultimoDigitoRuc,
  vencimientoPorDia,
} from './obligation-rules';

describe('periodos', () => {
  it('desplaza periodos cruzando el año', () => {
    expect(desplazarPeriodo('2026-12', 1)).toBe('2027-01');
    expect(desplazarPeriodo('2027-01', -1)).toBe('2026-12');
  });

  it('genera el periodo del mes anterior a la fecha actual', () => {
    expect(periodoAGenerar('2026-12-01')).toBe('2026-11');
    expect(periodoAGenerar('2027-01-15')).toBe('2026-12');
  });

  it('respeta la vigencia de la obligación del cliente', () => {
    expect(aplicaEnPeriodo('2026-10', '2026-10', null)).toBe(true);
    expect(aplicaEnPeriodo('2026-09', '2026-10', null)).toBe(false);
    expect(aplicaEnPeriodo('2026-12', '2026-10', '2026-11')).toBe(false);
  });
});

describe('vencimientoPorDia', () => {
  it('vence el día indicado del mes siguiente al periodo', () => {
    expect(vencimientoPorDia('2026-10', 10)).toBe('2026-11-10');
    expect(vencimientoPorDia('2026-12', 15)).toBe('2027-01-15');
  });

  it('usa el último día cuando el mes siguiente es más corto', () => {
    expect(vencimientoPorDia('2027-01', 28)).toBe('2027-02-28');
  });
});

describe('ultimoDigitoRuc', () => {
  it('toma el último dígito de un RUC de 11 dígitos', () => {
    expect(ultimoDigitoRuc('20100070970')).toBe(0);
    expect(ultimoDigitoRuc('10456789123')).toBe(3);
  });

  it('no inventa un dígito sin RUC válido', () => {
    expect(ultimoDigitoRuc(null)).toBeNull();
    expect(ultimoDigitoRuc('1234')).toBeNull();
  });
});

describe('estadoObligacion', () => {
  it('sigue el flujo de la tarea asociada', () => {
    expect(estadoObligacion('PENDIENTE', false)).toBe('PENDIENTE');
    expect(estadoObligacion('EN_PROCESO', false)).toBe('EN_PROCESO');
    expect(estadoObligacion('EN_REVISION', true)).toBe('PRESENTADA');
    expect(estadoObligacion('OBSERVADA', true)).toBe('OBSERVADA');
    expect(estadoObligacion('CORREGIDA', true)).toBe('OBSERVADA');
    expect(estadoObligacion('APROBADA', true)).toBe('CUMPLIDA');
    expect(estadoObligacion('FINALIZADA', true)).toBe('CUMPLIDA');
    expect(estadoObligacion('CANCELADA', false)).toBe('ANULADA');
  });

  it('considera presentada una obligación con constancia aunque la tarea siga abierta', () => {
    expect(estadoObligacion('EN_PROCESO', true)).toBe('PRESENTADA');
  });
});

describe('estaVencida', () => {
  it('solo vence lo que no se presentó a tiempo', () => {
    expect(estaVencida('PENDIENTE', '2026-11-10', '2026-11-11')).toBe(true);
    expect(estaVencida('OBSERVADA', '2026-11-10', '2026-11-11')).toBe(true);
    expect(estaVencida('PRESENTADA', '2026-11-10', '2026-11-11')).toBe(false);
    expect(estaVencida('PENDIENTE', '2026-11-11', '2026-11-11')).toBe(false);
  });
});

describe('alertas de obligaciones', () => {
  it('avisa en los días configurados antes del vencimiento', () => {
    expect(clasificarAlertaObligacion('2026-11-16', '2026-11-11', [5, 3, 1])).toBe('OBLIGACION_POR_VENCER');
    expect(clasificarAlertaObligacion('2026-11-15', '2026-11-11', [5, 3, 1])).toBeNull();
    expect(clasificarAlertaObligacion('2026-11-10', '2026-11-11', [5, 3, 1])).toBe('OBLIGACION_VENCIDA');
  });

  it('avisa el vencimiento una sola vez y el aviso previo una vez por día', () => {
    const vencida = claveAlertaObligacion('OBLIGACION_VENCIDA', 'o1', '2026-11-10', '2026-11-11', 'u1');
    const previa = claveAlertaObligacion('OBLIGACION_POR_VENCER', 'o1', '2026-11-16', '2026-11-11', 'u1');

    expect(claveAlertaObligacion('OBLIGACION_VENCIDA', 'o1', '2026-11-10', '2026-11-12', 'u1')).toBe(vencida);
    expect(claveAlertaObligacion('OBLIGACION_POR_VENCER', 'o1', '2026-11-16', '2026-11-13', 'u1')).not.toBe(previa);
  });
});
