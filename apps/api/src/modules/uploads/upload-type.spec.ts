import { describe, expect, it } from 'vitest';
import { detectarTipoSubida } from './upload-type';

const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00]);

describe('detectarTipoSubida', () => {
  it('reconoce PDF y Office por su contenido', () => {
    expect(detectarTipoSubida(Buffer.from('%PDF-1.7'), 'informe.pdf')?.mime).toBe('application/pdf');
    expect(detectarTipoSubida(ZIP, 'balance.xlsx')?.extension).toBe('xlsx');
    expect(detectarTipoSubida(OLE, 'antiguo.doc')?.extension).toBe('doc');
    expect(detectarTipoSubida(OLE, 'presentacion.ppt')?.extension).toBe('ppt');
  });

  it('acepta ZIP, CSV y TXT solo con contenido coherente', () => {
    expect(detectarTipoSubida(ZIP, 'expediente.zip')?.mime).toBe('application/zip');
    expect(detectarTipoSubida(Buffer.from('ruc;razon social\n20100070970;Ñandú SAC'), 'clientes.csv')?.mime).toBe('text/csv');
    expect(detectarTipoSubida(Buffer.from('nota simple'), 'nota.txt')?.mime).toBe('text/plain');
    expect(detectarTipoSubida(Buffer.from([0x00, 0x01, 0x02]), 'falso.csv')).toBeNull();
  });

  it('rechaza un archivo cuyo contenido no corresponde a su extensión', () => {
    expect(detectarTipoSubida(Buffer.from('MZ\x90\x00'), 'factura.pdf')).toBeNull();
    expect(detectarTipoSubida(ZIP, 'programa.exe')).toBeNull();
  });
});
