import { describe, expect, it } from 'vitest';
import { detectarTipoArchivo, nombreSeguro } from './file-signature';

function bytes(...valores: number[]): Buffer {
  return Buffer.concat([Buffer.from(valores), Buffer.alloc(16)]);
}

describe('detectarTipoArchivo', () => {
  it('reconoce PDF, PNG, JPEG y WEBP por su firma aunque la extensión mienta', () => {
    expect(detectarTipoArchivo(Buffer.from('%PDF-1.7 contenido'), 'foto.jpg')?.mime).toBe('application/pdf');
    expect(detectarTipoArchivo(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), 'x')?.mime).toBe('image/png');
    expect(detectarTipoArchivo(bytes(0xff, 0xd8, 0xff, 0xe0), 'x')?.mime).toBe('image/jpeg');
    expect(
      detectarTipoArchivo(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]), 'x')?.mime,
    ).toBe('image/webp');
  });

  it('distingue documentos de Office por firma y extensión', () => {
    const zip = bytes(0x50, 0x4b, 0x03, 0x04);
    expect(detectarTipoArchivo(zip, 'informe.DOCX')?.extension).toBe('docx');
    expect(detectarTipoArchivo(zip, 'balance.xlsx')?.extension).toBe('xlsx');
    expect(detectarTipoArchivo(zip, 'paquete.zip')).toBeNull();

    const ole = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    expect(detectarTipoArchivo(ole, 'antiguo.xls')?.extension).toBe('xls');
    expect(detectarTipoArchivo(ole, 'antiguo.msi')).toBeNull();
  });

  it('rechaza ejecutables y texto con extensión de documento', () => {
    expect(detectarTipoArchivo(bytes(0x4d, 0x5a, 0x90, 0x00), 'factura.pdf')).toBeNull();
    expect(detectarTipoArchivo(Buffer.from('<html><script>'), 'evidencia.png')).toBeNull();
  });
});

describe('nombreSeguro', () => {
  it('elimina separadores de ruta y caracteres de control', () => {
    expect(nombreSeguro('../../etc/passwd')).toBe('.._.._etc_passwd');
    expect(nombreSeguro('a\u0000b.pdf')).toBe('a_b.pdf');
    expect(nombreSeguro('   ')).toBe('archivo');
  });
});
