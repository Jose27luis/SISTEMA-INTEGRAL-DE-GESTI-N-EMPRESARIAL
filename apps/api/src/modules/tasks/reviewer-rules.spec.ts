import { describe, expect, it } from 'vitest';
import { nuevoRevisor } from './reviewer-rules';

describe('nuevoRevisor', () => {
  it('pasa la revisión al nuevo usuario cuando el saliente era revisor', () => {
    expect(nuevoRevisor('saliente', 'saliente', 'destino', 'responsable', 'gerencia')).toBe('destino');
  });

  it('conserva al revisor cuando no era el saliente', () => {
    expect(nuevoRevisor('revisor', 'saliente', 'destino', 'destino', 'gerencia')).toBe('revisor');
  });

  it('evita que el responsable final sea su propio revisor usando a quien asignó la tarea', () => {
    expect(nuevoRevisor('destino', 'saliente', 'destino', 'destino', 'gerencia')).toBe('gerencia');
    expect(nuevoRevisor('saliente', 'saliente', 'destino', 'destino', 'gerencia')).toBe('gerencia');
  });

  it('deja la tarea sin revisor si no hay nadie distinto del responsable', () => {
    expect(nuevoRevisor('saliente', 'saliente', 'destino', 'destino', 'destino')).toBeNull();
    expect(nuevoRevisor(null, 'saliente', 'destino', 'destino', 'gerencia')).toBeNull();
  });
});
