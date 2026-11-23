import { describe, expect, it } from 'vitest';
import { fechaDeCelda, normalizarClave, textoDeCelda } from './cell-values';

describe('textoDeCelda', () => {
  it('convierte un RUC guardado como número sin notación científica', () => {
    expect(textoDeCelda(20100070970)).toBe('20100070970');
  });

  it('limpia espacios y lee textos enriquecidos, hipervínculos y fórmulas', () => {
    expect(textoDeCelda('  Comercial Andina  ')).toBe('Comercial Andina');
    expect(textoDeCelda({ richText: [{ text: 'Comercial ' }, { text: 'Andina' }] })).toBe('Comercial Andina');
    expect(textoDeCelda({ text: 'contacto@empresa.pe', hyperlink: 'mailto:contacto@empresa.pe' })).toBe(
      'contacto@empresa.pe',
    );
    expect(textoDeCelda({ formula: 'A1', result: 'Calculado' })).toBe('Calculado');
  });

  it('devuelve texto vacío para celdas vacías', () => {
    expect(textoDeCelda(null)).toBe('');
    expect(textoDeCelda(undefined)).toBe('');
  });
});

describe('fechaDeCelda', () => {
  it('acepta fechas de Excel, ISO y día/mes/año', () => {
    expect(fechaDeCelda(new Date(Date.UTC(2026, 0, 15)))).toBe('2026-01-15');
    expect(fechaDeCelda('2026-01-15')).toBe('2026-01-15');
    expect(fechaDeCelda('15/01/2026')).toBe('2026-01-15');
    expect(fechaDeCelda('5/1/2026')).toBe('2026-01-05');
  });

  it('rechaza fechas inexistentes o con otro formato', () => {
    expect(fechaDeCelda('31/02/2026')).toBeNull();
    expect(fechaDeCelda('enero 2026')).toBeNull();
    expect(fechaDeCelda('')).toBeNull();
  });
});

describe('normalizarClave', () => {
  it('ignora tildes, mayúsculas y espacios repetidos', () => {
    expect(normalizarClave('  Régimen   MYPE Tributario ')).toBe('regimen mype tributario');
  });
});
