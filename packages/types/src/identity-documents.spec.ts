import { describe, expect, it } from 'vitest';
import { esDniValido, esRucValido } from './identity-documents';

describe('esRucValido', () => {
  it('acepta RUC con dígito verificador correcto', () => {
    expect(esRucValido('20100070970')).toBe(true);
    expect(esRucValido('20131312955')).toBe(true);
  });

  it('rechaza RUC con dígito verificador incorrecto', () => {
    expect(esRucValido('20100070971')).toBe(false);
  });

  it('rechaza prefijos no válidos y longitudes distintas de 11', () => {
    expect(esRucValido('30100070970')).toBe(false);
    expect(esRucValido('2010007097')).toBe(false);
    expect(esRucValido('2010007097A')).toBe(false);
  });
});

describe('esDniValido', () => {
  it('acepta exactamente 8 dígitos', () => {
    expect(esDniValido('12345678')).toBe(true);
    expect(esDniValido('1234567')).toBe(false);
    expect(esDniValido('1234567A')).toBe(false);
  });
});
