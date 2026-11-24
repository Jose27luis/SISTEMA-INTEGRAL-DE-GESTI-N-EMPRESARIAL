import { describe, expect, it } from 'vitest';
import { correspondeEnFecha, diaIsoDeSemana, ocurrenciasEntre, proximaOcurrencia, type ReglaFechas } from './recurrence-rules';

const mensual: ReglaFechas = {
  frecuencia: 'MENSUAL',
  diaDelMes: 10,
  diaDeSemana: null,
  vigenteDesde: '2026-11-01',
  vigenteHasta: null,
};

const semanal: ReglaFechas = {
  frecuencia: 'SEMANAL',
  diaDelMes: null,
  diaDeSemana: 1,
  vigenteDesde: '2026-11-01',
  vigenteHasta: '2026-11-30',
};

describe('recurrencia', () => {
  it('calcula el día ISO de la semana', () => {
    expect(diaIsoDeSemana('2026-11-23')).toBe(1);
    expect(diaIsoDeSemana('2026-11-29')).toBe(7);
  });

  it('genera la mensual solo en su día y dentro de la vigencia', () => {
    expect(correspondeEnFecha(mensual, '2026-11-10')).toBe(true);
    expect(correspondeEnFecha(mensual, '2026-11-11')).toBe(false);
    expect(correspondeEnFecha({ ...mensual, vigenteDesde: '2026-11-11' }, '2026-11-10')).toBe(false);
  });

  it('genera la semanal cada lunes hasta su fin de vigencia', () => {
    expect(ocurrenciasEntre(semanal, '2026-11-01', '2026-12-15')).toEqual([
      '2026-11-02',
      '2026-11-09',
      '2026-11-16',
      '2026-11-23',
      '2026-11-30',
    ]);
  });

  it('recupera las ocurrencias de un rango cuando el proceso no corrió', () => {
    expect(ocurrenciasEntre(mensual, '2026-11-05', '2026-12-12')).toEqual(['2026-11-10', '2026-12-10']);
  });

  it('informa la próxima ocurrencia o ninguna si terminó la vigencia', () => {
    expect(proximaOcurrencia(mensual, '2026-11-11')).toBe('2026-12-10');
    expect(proximaOcurrencia(semanal, '2026-12-01')).toBeNull();
  });
});
