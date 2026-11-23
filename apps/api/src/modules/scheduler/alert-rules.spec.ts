import { describe, expect, it } from 'vitest';
import { claveAlerta, clasificarAlerta } from './alert-rules';

describe('clasificarAlerta', () => {
  const hoy = '2026-11-23';
  const manana = '2026-11-24';

  it('marca atrasadas las tareas con fecha límite pasada', () => {
    expect(clasificarAlerta('2026-11-22', hoy, manana)).toBe('TAREA_ATRASADA');
  });

  it('avisa las tareas que vencen hoy o mañana', () => {
    expect(clasificarAlerta(hoy, hoy, manana)).toBe('TAREA_POR_VENCER');
    expect(clasificarAlerta(manana, hoy, manana)).toBe('TAREA_POR_VENCER');
  });

  it('no avisa las tareas con más plazo', () => {
    expect(clasificarAlerta('2026-11-25', hoy, manana)).toBeNull();
  });
});

describe('claveAlerta', () => {
  it('genera una clave por tarea, usuario y día para no repetir avisos', () => {
    const primera = claveAlerta('TAREA_ATRASADA', 't1', '2026-11-20', '2026-11-23', 'u1');

    expect(claveAlerta('TAREA_ATRASADA', 't1', '2026-11-20', '2026-11-23', 'u1')).toBe(primera);
    expect(claveAlerta('TAREA_ATRASADA', 't1', '2026-11-20', '2026-11-24', 'u1')).not.toBe(primera);
    expect(claveAlerta('TAREA_ATRASADA', 't1', '2026-11-20', '2026-11-23', 'u2')).not.toBe(primera);
  });

  it('avisa una vez por día las tareas por vencer', () => {
    expect(claveAlerta('TAREA_POR_VENCER', 't1', '2026-11-24', '2026-11-23', 'u1')).not.toBe(
      claveAlerta('TAREA_POR_VENCER', 't1', '2026-11-24', '2026-11-24', 'u1'),
    );
  });
});
