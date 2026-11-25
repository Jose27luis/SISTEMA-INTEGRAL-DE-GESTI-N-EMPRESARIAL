import { describe, expect, it } from 'vitest';
import { armarPasos, evaluarSeguimiento } from './task-tracking-rules';

const creada = new Date('2026-11-23T14:00:00Z');

describe('evaluarSeguimiento', () => {
  it('marca sin acuse cuando pasan 24 horas sin confirmar', () => {
    const datos = { estado: 'PENDIENTE' as const, prioridad: 'MEDIA' as const, fechaLimite: '2026-12-10', estricto: true, creadoEn: creada, recibidaEn: null, ultimoReporteEn: null };
    expect(evaluarSeguimiento(datos, new Date('2026-11-24T10:00:00Z'), '2026-11-24')).toMatchObject({ esperandoAcuse: true, sinAcuse: false });
    expect(evaluarSeguimiento(datos, new Date('2026-11-24T15:00:00Z'), '2026-11-24')).toMatchObject({ esperandoAcuse: true, sinAcuse: true, sinReporte: false });
  });

  it('marca sin reporte según la prioridad y los días hábiles', () => {
    const base = {
      estado: 'EN_PROCESO' as const,
      fechaLimite: '2026-12-30',
      estricto: true,
      creadoEn: creada,
      recibidaEn: creada,
      ultimoReporteEn: new Date('2026-11-27T15:00:00Z'),
    };
    expect(evaluarSeguimiento({ ...base, prioridad: 'URGENTE' }, new Date(), '2026-11-30')).toMatchObject({ limiteReporte: '2026-11-30', sinReporte: false });
    expect(evaluarSeguimiento({ ...base, prioridad: 'URGENTE' }, new Date(), '2026-12-01')).toMatchObject({ sinReporte: true });
    expect(evaluarSeguimiento({ ...base, prioridad: 'BAJA' }, new Date(), '2026-12-01')).toMatchObject({ limiteReporte: '2026-12-04', sinReporte: false });
  });

  it('no aplica reglas estrictas a tareas anteriores ni cerradas', () => {
    const datos = { estado: 'PENDIENTE' as const, prioridad: 'URGENTE' as const, fechaLimite: '2026-11-20', estricto: false, creadoEn: creada, recibidaEn: null, ultimoReporteEn: null };
    expect(evaluarSeguimiento(datos, new Date('2026-12-01T00:00:00Z'), '2026-12-01')).toMatchObject({ esperandoAcuse: false, sinAcuse: false, sinReporte: false, semaforo: 'VENCIDA' });
    expect(evaluarSeguimiento({ ...datos, estricto: true, estado: 'FINALIZADA' }, new Date(), '2026-12-01').semaforo).toBe('CERRADA');
  });
});

describe('armarPasos', () => {
  const base = { estricto: true, requiereAprobacion: true, creadoEn: creada, asignadoPor: 'Gerente', responsable: 'Rosa' };

  it('muestra la etapa actual y las anteriores con su fecha', () => {
    const pasos = armarPasos(
      { ...base, estado: 'EN_PROCESO', recibidaEn: new Date('2026-11-23T15:00:00Z') },
      [{ hacia: 'EN_PROCESO', fecha: new Date('2026-11-23T16:00:00Z'), usuario: 'Rosa' }],
      new Date('2026-11-23T17:00:00Z'),
    );
    expect(pasos.map(({ etapa, situacion }) => `${etapa}:${situacion}`)).toEqual([
      'ASIGNADA:HECHA',
      'RECIBIDA:HECHA',
      'EN_PROCESO:ACTUAL',
      'EN_REVISION:PENDIENTE',
      'APROBADA:PENDIENTE',
      'FINALIZADA:PENDIENTE',
    ]);
    expect(pasos[0]?.minutosEnEtapa).toBe(60);
    expect(pasos[2]?.minutosEnEtapa).toBe(60);
  });

  it('omite recepción y revisión cuando no aplican', () => {
    const pasos = armarPasos({ ...base, estricto: false, requiereAprobacion: false, estado: 'FINALIZADA', recibidaEn: null }, [], new Date());
    expect(pasos.map(({ etapa }) => etapa)).toEqual(['ASIGNADA', 'EN_PROCESO', 'FINALIZADA']);
    expect(pasos.at(-1)?.situacion).toBe('HECHA');
  });

  it('una observación mantiene la tarea en revisión', () => {
    const pasos = armarPasos({ ...base, estado: 'OBSERVADA', recibidaEn: creada }, [], new Date());
    expect(pasos.find(({ etapa }) => etapa === 'EN_REVISION')?.situacion).toBe('ACTUAL');
  });
});
