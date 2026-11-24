import { describe, expect, it } from 'vitest';
import { claveAvisoFecha, clasificarAvisoFecha, diasEntre, textoPlazo } from './document-alert-rules';

describe('clasificarAvisoFecha', () => {
  const hoy = '2026-11-24';

  it('avisa solo en los días configurados antes de la fecha', () => {
    expect(clasificarAvisoFecha('2026-12-24', hoy, [30, 15, 7, 1])).toEqual({ tipo: 'PREVIO', dias: 30 });
    expect(clasificarAvisoFecha('2026-11-25', hoy, [30, 15, 7, 1])).toEqual({ tipo: 'PREVIO', dias: 1 });
    expect(clasificarAvisoFecha('2026-12-20', hoy, [30, 15, 7, 1])).toBeNull();
  });

  it('marca vencido lo que ya pasó la fecha', () => {
    expect(clasificarAvisoFecha('2026-11-23', hoy, [3, 1])).toEqual({ tipo: 'VENCIDO' });
  });

  it('no avisa el mismo día si no está configurado', () => {
    expect(clasificarAvisoFecha(hoy, hoy, [3, 1])).toBeNull();
  });
});

describe('claveAvisoFecha', () => {
  it('avisa el vencimiento una sola vez y cada aviso previo una vez', () => {
    const vencido = claveAvisoFecha('DOC', 'd1', '2026-11-20', { tipo: 'VENCIDO' }, 'u1');
    const previo = claveAvisoFecha('DOC', 'd1', '2026-12-01', { tipo: 'PREVIO', dias: 7 }, 'u1');

    expect(claveAvisoFecha('DOC', 'd1', '2026-11-20', { tipo: 'VENCIDO' }, 'u1')).toBe(vencido);
    expect(claveAvisoFecha('DOC', 'd1', '2026-12-01', { tipo: 'PREVIO', dias: 1 }, 'u1')).not.toBe(previo);
    expect(claveAvisoFecha('DOC', 'd1', '2026-12-08', { tipo: 'PREVIO', dias: 7 }, 'u1')).not.toBe(previo);
  });
});

describe('textos', () => {
  it('cuenta días entre fechas y describe el plazo', () => {
    expect(diasEntre('2026-11-24', '2026-12-01')).toBe(7);
    expect(textoPlazo({ tipo: 'PREVIO', dias: 1 })).toBe('vence mañana');
    expect(textoPlazo({ tipo: 'PREVIO', dias: 15 })).toBe('vence en 15 días');
    expect(textoPlazo({ tipo: 'VENCIDO' })).toBe('venció');
  });
});
