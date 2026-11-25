import { describe, expect, it } from 'vitest';
import { avanceDeTareas, formatearCodigoProyecto, proyectoAtrasado, transicionPermitida } from './project-rules';

describe('avanceDeTareas', () => {
  it('promedia el avance y cuenta como completas las tareas cerradas', () => {
    expect(avanceDeTareas([])).toBe(0);
    expect(
      avanceDeTareas([
        { estado: 'APROBADA', porcentajeAvance: 80 },
        { estado: 'EN_PROCESO', porcentajeAvance: 50 },
        { estado: 'PENDIENTE', porcentajeAvance: 0 },
      ]),
    ).toBe(50);
  });

  it('ignora las tareas canceladas', () => {
    expect(
      avanceDeTareas([
        { estado: 'FINALIZADA', porcentajeAvance: 100 },
        { estado: 'CANCELADA', porcentajeAvance: 0 },
      ]),
    ).toBe(100);
  });
});

describe('proyectoAtrasado', () => {
  it('solo marca atrasados los proyectos abiertos con la entrega vencida', () => {
    expect(proyectoAtrasado('EN_CURSO', '2026-11-20', '2026-11-25')).toBe(true);
    expect(proyectoAtrasado('EN_CURSO', '2026-11-25', '2026-11-25')).toBe(false);
    expect(proyectoAtrasado('FINALIZADO', '2026-11-20', '2026-11-25')).toBe(false);
  });
});

describe('transicionPermitida', () => {
  it('sigue el flujo de estados del proyecto', () => {
    expect(transicionPermitida('PLANIFICADO', 'EN_CURSO')).toBe(true);
    expect(transicionPermitida('PLANIFICADO', 'FINALIZADO')).toBe(false);
    expect(transicionPermitida('EN_PAUSA', 'EN_CURSO')).toBe(true);
    expect(transicionPermitida('FINALIZADO', 'EN_CURSO')).toBe(false);
  });
});

describe('formatearCodigoProyecto', () => {
  it('rellena el correlativo', () => {
    expect(formatearCodigoProyecto(2026, 7n)).toBe('P-2026-0007');
  });
});
