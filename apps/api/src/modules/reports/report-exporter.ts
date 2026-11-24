import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Workbook } from 'exceljs';
import PDFDocument from 'pdfkit';

export type ValorCelda = string | number;

export interface ColumnaExportable {
  titulo: string;
  ancho: number;
  numerica?: boolean;
}

export interface TablaExportable {
  titulo: string;
  filtros: string[];
  generadoPor: string;
  generadoEn: string;
  columnas: ColumnaExportable[];
  filas: ValorCelda[][];
  totales: ValorCelda[] | null;
}

const MARINO = '01295D';
const DORADO = 'F7C902';
const RUTA_LOGO = path.join(process.cwd(), 'assets', 'torres-logo.png');

function leerLogo(): Buffer | null {
  return existsSync(RUTA_LOGO) ? readFileSync(RUTA_LOGO) : null;
}

export async function exportarExcel(tabla: TablaExportable): Promise<Buffer> {
  const libro = new Workbook();
  libro.creator = 'SIGE · TORRES ASOCIADOS';
  libro.created = new Date();

  const hoja = libro.addWorksheet('Reporte', { views: [{ state: 'frozen', ySplit: 6 + tabla.filtros.length }] });
  hoja.columns = tabla.columnas.map((columna) => ({ width: columna.ancho }));

  const logo = leerLogo();

  if (logo !== null) {
    const imagen = libro.addImage({ buffer: new Uint8Array(logo).buffer, extension: 'png' });
    hoja.addImage(imagen, { tl: { col: 0, row: 0 }, ext: { width: 64, height: 64 } });
  }

  hoja.getRow(1).height = 26;
  hoja.getCell('B1').value = 'TORRES ASOCIADOS';
  hoja.getCell('B1').font = { bold: true, size: 14, color: { argb: `FF${MARINO}` } };
  hoja.getCell('B2').value = tabla.titulo;
  hoja.getCell('B2').font = { bold: true, size: 12 };

  let fila = 3;

  for (const filtro of tabla.filtros) {
    hoja.getCell(`B${String(fila)}`).value = filtro;
    fila += 1;
  }

  hoja.getCell(`B${String(fila)}`).value = `Generado por ${tabla.generadoPor} el ${tabla.generadoEn}`;
  hoja.getCell(`B${String(fila)}`).font = { italic: true, color: { argb: 'FF56627A' } };
  fila += 2;

  const encabezado = hoja.getRow(fila);
  encabezado.values = tabla.columnas.map(({ titulo }) => titulo);
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${MARINO}` } };
  encabezado.alignment = { vertical: 'middle', wrapText: true };

  for (const valores of tabla.filas) {
    hoja.addRow(valores);
  }

  if (tabla.totales !== null) {
    const totales = hoja.addRow(tabla.totales);
    totales.font = { bold: true };
    totales.border = { top: { style: 'thin', color: { argb: `FF${DORADO}` } } };
  }

  tabla.columnas.forEach((columna, indice) => {
    if (columna.numerica === true) {
      hoja.getColumn(indice + 1).alignment = { horizontal: 'right' };
    }
  });

  return Buffer.from(await libro.xlsx.writeBuffer());
}

export function exportarPdf(tabla: TablaExportable): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    const documento = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 36,
      bufferPages: true,
      info: { Title: tabla.titulo, Author: 'TORRES ASOCIADOS', Creator: 'SIGE' },
    });
    const partes: Buffer[] = [];

    documento.on('data', (parte: Buffer) => partes.push(parte));
    documento.on('end', () => {
      resolver(Buffer.concat(partes));
    });
    documento.on('error', rechazar);

    const izquierda = documento.page.margins.left;
    const anchoUtil = documento.page.width - documento.page.margins.left - documento.page.margins.right;
    const pesoTotal = tabla.columnas.reduce((suma, columna) => suma + columna.ancho, 0);
    const anchos = tabla.columnas.map((columna) => (columna.ancho / pesoTotal) * anchoUtil);
    const logo = leerLogo();

    const dibujarCabecera = (): void => {
      if (logo !== null) {
        documento.image(logo, izquierda, 30, { width: 44, height: 44 });
      }

      documento.fillColor(`#${MARINO}`).font('Helvetica-Bold').fontSize(14).text('TORRES ASOCIADOS', izquierda + 54, 34);
      documento.fillColor('#0F1B2D').fontSize(11).text(tabla.titulo, izquierda + 54, 52);
      documento.moveTo(izquierda, 80).lineTo(izquierda + anchoUtil, 80).lineWidth(2).strokeColor(`#${DORADO}`).stroke();
      documento.y = 88;
    };

    const dibujarFila = (valores: ValorCelda[], estilo: 'encabezado' | 'normal' | 'total', sombreada: boolean): void => {
      documento.font(estilo === 'normal' ? 'Helvetica' : 'Helvetica-Bold').fontSize(8);
      const textos = valores.map((valor) => String(valor));
      const alto =
        Math.max(...textos.map((texto, indice) => documento.heightOfString(texto, { width: (anchos[indice] ?? 40) - 8 }))) + 8;

      if (documento.y + alto > documento.page.height - documento.page.margins.bottom - 16) {
        documento.addPage();
        dibujarCabecera();
        dibujarFila(
          tabla.columnas.map(({ titulo }) => titulo),
          'encabezado',
          false,
        );
        documento.font(estilo === 'normal' ? 'Helvetica' : 'Helvetica-Bold').fontSize(8);
      }

      const y = documento.y;

      if (estilo === 'encabezado') {
        documento.rect(izquierda, y, anchoUtil, alto).fill(`#${MARINO}`);
      } else if (sombreada) {
        documento.rect(izquierda, y, anchoUtil, alto).fill('#F4F6F9');
      }

      let x = izquierda;

      textos.forEach((texto, indice) => {
        const ancho = anchos[indice] ?? 40;
        documento
          .fillColor(estilo === 'encabezado' ? '#FFFFFF' : '#0F1B2D')
          .text(texto, x + 4, y + 4, {
            width: ancho - 8,
            align: tabla.columnas[indice]?.numerica === true ? 'right' : 'left',
          });
        x += ancho;
      });

      if (estilo === 'total') {
        documento.moveTo(izquierda, y).lineTo(izquierda + anchoUtil, y).lineWidth(1).strokeColor(`#${DORADO}`).stroke();
      }

      documento.y = y + alto;
    };

    dibujarCabecera();
    documento.font('Helvetica').fontSize(9).fillColor('#56627A');

    for (const filtro of tabla.filtros) {
      documento.text(filtro, izquierda, documento.y);
    }

    documento.text(`Generado por ${tabla.generadoPor} el ${tabla.generadoEn}`, izquierda, documento.y);
    documento.moveDown(0.8);

    dibujarFila(
      tabla.columnas.map(({ titulo }) => titulo),
      'encabezado',
      false,
    );

    if (tabla.filas.length === 0) {
      documento.font('Helvetica').fontSize(9).fillColor('#56627A').text('Sin registros para los filtros elegidos.', izquierda, documento.y + 6);
    }

    tabla.filas.forEach((valores, indice) => {
      dibujarFila(valores, 'normal', indice % 2 === 1);
    });

    if (tabla.totales !== null) {
      dibujarFila(tabla.totales, 'total', false);
    }

    const paginas = documento.bufferedPageRange();

    for (let indice = 0; indice < paginas.count; indice += 1) {
      documento.switchToPage(paginas.start + indice);
      documento.page.margins.bottom = 0;
      documento
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#56627A')
        .text(
          `Página ${String(indice + 1)} de ${String(paginas.count)}`,
          izquierda,
          documento.page.height - 24,
          { width: anchoUtil, align: 'right', lineBreak: false },
        );
    }

    documento.end();
  });
}
