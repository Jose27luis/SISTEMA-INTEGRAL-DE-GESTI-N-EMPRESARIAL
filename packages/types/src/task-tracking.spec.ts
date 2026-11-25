import { describe, expect, it } from 'vitest';
import { diasHabilesEntre, limiteDeReporte, semaforoTarea, sumarDiasHabiles } from './task-tracking';

describe('días hábiles', () => {
  it('no cuenta sábados ni domingos', () => {
    expect(diasHabilesEntre('2026-11-27', '2026-11-30')).toBe(1);
    expect(diasHabilesEntre('2026-11-23', '2026-11-27')).toBe(4);
    expect(diasHabilesEntre('2026-11-25', '2026-11-25')).toBe(0);
  });

  it('suma días hábiles saltando el fin de semana', () => {
    expect(sumarDiasHabiles('2026-11-27', 1)).toBe('2026-11-30');
    expect(sumarDiasHabiles('2026-11-25', 3)).toBe('2026-11-30');
  });
});

describe('límite de reporte según prioridad', () => {
  it('urgente al día hábil siguiente y baja a los cinco', () => {
    expect(limiteDeReporte('URGENTE', '2026-11-27')).toBe('2026-11-30');
    expect(limiteDeReporte('MEDIA', '2026-11-23')).toBe('2026-11-26');
    expect(limiteDeReporte('BAJA', '2026-11-23')).toBe('2026-11-30');
  });
});

describe('semáforo', () => {
  it('clasifica por días a la fecha límite', () => {
    expect(semaforoTarea('EN_PROCESO', '2026-12-10', '2026-11-25')).toBe('A_TIEMPO');
    expect(semaforoTarea('EN_PROCESO', '2026-11-27', '2026-11-25')).toBe('POR_VENCER');
    expect(semaforoTarea('PENDIENTE', '2026-11-24', '2026-11-25')).toBe('VENCIDA');
    expect(semaforoTarea('FINALIZADA', '2026-11-24', '2026-11-25')).toBe('CERRADA');
  });
});
