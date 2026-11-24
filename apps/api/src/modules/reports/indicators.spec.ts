import { describe, expect, it } from 'vitest';
import { calcularConteo, type TareaIndicador } from './indicators';

const periodo = { desde: '2026-11-01', hasta: '2026-11-30' };
const hoy = '2026-11-20';

function tarea(cambios: Partial<TareaIndicador>): TareaIndicador {
  return {
    responsableId: 'u1',
    estado: 'EN_PROCESO',
    fechaLimite: '2026-11-25',
    creadaEl: '2026-11-02',
    completadaEl: null,
    ...cambios,
  };
}

describe('calcularConteo', () => {
  it('cuenta asignadas, terminadas, abiertas y atrasadas del periodo', () => {
    const conteo = calcularConteo(
      [
        tarea({}),
        tarea({ fechaLimite: '2026-11-10' }),
        tarea({ estado: 'FINALIZADA', completadaEl: '2026-11-05', fechaLimite: '2026-11-06' }),
        tarea({ estado: 'APROBADA', creadaEl: '2026-10-20', completadaEl: '2026-11-03', fechaLimite: '2026-10-31' }),
      ],
      [],
      [],
      periodo,
      hoy,
    );

    expect(conteo.asignadas).toBe(3);
    expect(conteo.terminadas).toBe(2);
    expect(conteo.abiertas).toBe(2);
    expect(conteo.atrasadas).toBe(1);
  });

  it('calcula el cumplimiento solo con tareas que vencen en el periodo y ya pueden evaluarse', () => {
    const conteo = calcularConteo(
      [
        tarea({ estado: 'FINALIZADA', completadaEl: '2026-11-05', fechaLimite: '2026-11-06' }),
        tarea({ estado: 'FINALIZADA', completadaEl: '2026-11-09', fechaLimite: '2026-11-08' }),
        tarea({ fechaLimite: '2026-11-10' }),
        tarea({ fechaLimite: '2026-11-28' }),
        tarea({ estado: 'CANCELADA', fechaLimite: '2026-11-04' }),
      ],
      [],
      [],
      periodo,
      hoy,
    );

    expect(conteo.cumplimiento).toBe(33);
  });

  it('deja el cumplimiento vacío si no hay nada que evaluar', () => {
    expect(calcularConteo([tarea({ fechaLimite: '2026-11-28' })], [], [], periodo, hoy).cumplimiento).toBeNull();
  });

  it('suma rondas de revisión y minutos', () => {
    const conteo = calcularConteo(
      [],
      [
        { responsableId: 'u1', decision: 'APROBADA', fecha: '2026-11-03' },
        { responsableId: 'u1', decision: 'OBSERVADA', fecha: '2026-11-02' },
        { responsableId: 'u1', decision: 'OBSERVADA', fecha: '2026-11-04' },
      ],
      [
        { autorId: 'u1', minutos: 30 },
        { autorId: 'u1', minutos: 45 },
      ],
      periodo,
      hoy,
    );

    expect(conteo.aprobadas).toBe(1);
    expect(conteo.observadas).toBe(2);
    expect(conteo.minutos).toBe(75);
  });
});
