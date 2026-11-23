import type { CellValue } from 'exceljs';

export function textoDeCelda(valor: CellValue): string {
  if (valor === null || valor === undefined) {
    return '';
  }

  if (typeof valor === 'string') {
    return valor.trim();
  }

  if (typeof valor === 'number') {
    return Number.isInteger(valor) ? valor.toFixed(0) : String(valor);
  }

  if (typeof valor === 'boolean') {
    return valor ? 'SI' : 'NO';
  }

  if (valor instanceof Date) {
    return valor.toISOString().slice(0, 10);
  }

  if ('richText' in valor) {
    return valor.richText.map(({ text }) => text).join('').trim();
  }

  if ('hyperlink' in valor) {
    return valor.text.trim();
  }

  if ('result' in valor) {
    return textoDeCelda(valor.result);
  }

  return '';
}

const PATRON_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const PATRON_PERUANO = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function componer(anio: number, mes: number, dia: number): string | null {
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) {
    return null;
  }

  return fecha.toISOString().slice(0, 10);
}

export function fechaDeCelda(valor: CellValue): string | null {
  if (valor instanceof Date) {
    return valor.toISOString().slice(0, 10);
  }

  const texto = textoDeCelda(valor);
  const iso = PATRON_ISO.exec(texto);

  if (iso !== null) {
    return componer(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const peruano = PATRON_PERUANO.exec(texto);

  if (peruano !== null) {
    return componer(Number(peruano[3]), Number(peruano[2]), Number(peruano[1]));
  }

  return null;
}

export function normalizarClave(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}
