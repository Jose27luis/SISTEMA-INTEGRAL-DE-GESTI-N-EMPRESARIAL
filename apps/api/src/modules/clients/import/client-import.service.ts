import { BadRequestException, Injectable } from '@nestjs/common';
import {
  type ClienteEntrada,
  esquemaClienteEntrada,
  type FilaRechazada,
  type ResultadoImportacion,
} from '@sige/types';
import { Workbook, type Row } from 'exceljs';
import { z } from 'zod';
import type { UsuarioAutenticado } from '../../../common/auth/authenticated-request';
import { fechaHoyEnLima } from '../../../common/dates';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ActorAuditoria } from '../../audit/audit.service';
import { GestionClientesService } from '../clients-command.service';
import { fechaDeCelda, normalizarClave, textoDeCelda } from './cell-values';

const COLUMNAS = [
  'Tipo de persona',
  'RUC',
  'DNI',
  'Razón social o nombres',
  'Domicilio fiscal',
  'Representante legal',
  'Actividad económica',
  'Régimen tributario',
  'Fecha de incorporación',
  'Contacto principal',
  'Correo del contacto',
  'Teléfono del contacto',
] as const;

const MAXIMO_FILAS = 2000;
const FILAS_CON_VALIDACION = 500;
const esquemaCorreo = z.email();

interface FilaLeida {
  numero: number;
  documento: string | null;
  entrada: ClienteEntrada | null;
  contacto: { nombre: string; correo: string | null; telefono: string | null } | null;
  errores: string[];
}

@Injectable()
export class ImportacionClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientes: GestionClientesService,
  ) {}

  async generarPlantilla(): Promise<Buffer> {
    const regimenes = await this.prisma.regimenTributario.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: { nombre: true },
    });

    const libro = new Workbook();
    libro.creator = 'TORRES ASOCIADOS – Sistema de Gestión Empresarial';

    const hoja = libro.addWorksheet('Clientes', { views: [{ state: 'frozen', ySplit: 1 }] });
    hoja.columns = COLUMNAS.map((titulo) => ({ header: titulo, width: Math.max(18, titulo.length + 6) }));

    const encabezado = hoja.getRow(1);
    encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF01295D' } };
    encabezado.height = 22;

    for (let fila = 2; fila <= FILAS_CON_VALIDACION; fila += 1) {
      hoja.getCell(`A${String(fila)}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: ['"NATURAL,JURIDICA"'],
      };
      hoja.getCell(`B${String(fila)}`).numFmt = '@';
      hoja.getCell(`C${String(fila)}`).numFmt = '@';
      hoja.getCell(`I${String(fila)}`).numFmt = 'dd/mm/yyyy';

      if (regimenes.length > 0) {
        hoja.getCell(`H${String(fila)}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${regimenes.map(({ nombre }) => nombre).join(',')}"`],
        };
      }
    }

    const instrucciones = libro.addWorksheet('Instrucciones');
    instrucciones.getColumn(1).width = 110;
    [
      'Complete una fila por cliente en la hoja "Clientes" sin cambiar el orden ni el nombre de las columnas.',
      'Tipo de persona: NATURAL o JURIDICA.',
      'RUC: 11 dígitos con dígito verificador válido. Obligatorio para personas jurídicas.',
      'DNI: 8 dígitos. Debe indicar el RUC o el DNI.',
      'Régimen tributario: uno de los regímenes activos del sistema (puede elegirlo de la lista).',
      'Fecha de incorporación: dd/mm/aaaa. Si se deja vacía se usa la fecha de importación.',
      'Contacto principal, correo y teléfono son opcionales.',
      'Los clientes cuyo RUC o DNI ya existe se rechazan y se informan en el resultado.',
    ].forEach((texto, indice) => {
      instrucciones.getCell(`A${String(indice + 1)}`).value = texto;
    });

    return Buffer.from(await libro.xlsx.writeBuffer());
  }

  async importar(
    archivo: Buffer,
    usuario: UsuarioAutenticado,
    actor: ActorAuditoria,
  ): Promise<ResultadoImportacion> {
    const libro = new Workbook();

    try {
      await libro.xlsx.load(new Uint8Array(archivo).buffer);
    } catch {
      throw new BadRequestException({ mensaje: 'El archivo no es un Excel (.xlsx) válido.', errores: [] });
    }

    const hoja = libro.worksheets[0];

    if (hoja === undefined) {
      throw new BadRequestException({ mensaje: 'El archivo no tiene hojas.', errores: [] });
    }

    this.validarEncabezado(hoja.getRow(1));

    const regimenes = new Map(
      (await this.prisma.regimenTributario.findMany({ where: { activo: true } })).map((regimen) => [
        normalizarClave(regimen.nombre),
        regimen.id,
      ]),
    );

    const filas: FilaLeida[] = [];

    hoja.eachRow({ includeEmpty: false }, (fila, numero) => {
      if (numero > 1) {
        filas.push(this.leerFila(fila, numero, regimenes));
      }
    });

    if (filas.length > MAXIMO_FILAS) {
      throw new BadRequestException({
        mensaje: `El archivo tiene ${String(filas.length)} filas; el máximo por importación es ${String(MAXIMO_FILAS)}.`,
        errores: [],
      });
    }

    const rechazadas: FilaRechazada[] = [];
    const documentosVistos = new Set<string>();
    let creados = 0;

    for (const fila of filas) {
      if (fila.entrada === null) {
        rechazadas.push({ fila: fila.numero, documento: fila.documento, errores: fila.errores });
        continue;
      }

      const claves = [fila.entrada.ruc, fila.entrada.dni].filter((valor): valor is string => valor !== null);

      if (claves.some((clave) => documentosVistos.has(clave))) {
        rechazadas.push({
          fila: fila.numero,
          documento: fila.documento,
          errores: ['El RUC o DNI se repite en otra fila del archivo.'],
        });
        continue;
      }

      claves.forEach((clave) => documentosVistos.add(clave));

      try {
        const clienteId = await this.clientes.crear(fila.entrada, usuario, actor, 'Importación desde Excel');

        if (fila.contacto !== null) {
          await this.prisma.contactoCliente.create({
            data: { ...fila.contacto, clienteId, principal: true },
          });
        }

        creados += 1;
      } catch (error) {
        rechazadas.push({ fila: fila.numero, documento: fila.documento, errores: [this.describirError(error)] });
      }
    }

    return { filasLeidas: filas.length, creados, rechazadas };
  }

  private validarEncabezado(encabezado: Row): void {
    const coincide = COLUMNAS.every(
      (titulo, indice) => normalizarClave(textoDeCelda(encabezado.getCell(indice + 1).value)) === normalizarClave(titulo),
    );

    if (!coincide) {
      throw new BadRequestException({
        mensaje: 'Las columnas no coinciden con la plantilla. Descargue la plantilla y vuelva a intentarlo.',
        errores: [],
      });
    }
  }

  private leerFila(fila: Row, numero: number, regimenes: Map<string, string>): FilaLeida {
    const celda = (columna: number): string => textoDeCelda(fila.getCell(columna).value);
    const errores: string[] = [];

    const tipo = normalizarClave(celda(1)).toUpperCase();
    const ruc = celda(2).replace(/\s/gu, '');
    const dni = celda(3).replace(/\s/gu, '');
    const documento = ruc !== '' ? ruc : dni !== '' ? dni : null;
    const regimenTexto = celda(8);
    const fechaTexto = celda(9);
    const fecha = fechaTexto === '' ? fechaHoyEnLima() : fechaDeCelda(fila.getCell(9).value);

    let regimenTributarioId: string | null = null;

    if (regimenTexto !== '') {
      regimenTributarioId = regimenes.get(normalizarClave(regimenTexto)) ?? null;

      if (regimenTributarioId === null) {
        errores.push(`El régimen tributario "${regimenTexto}" no existe o está desactivado.`);
      }
    }

    if (fecha === null) {
      errores.push('La fecha de incorporación debe tener el formato dd/mm/aaaa.');
    }

    const resultado = esquemaClienteEntrada.safeParse({
      tipoPersona: tipo === 'JURIDICA' || tipo === 'NATURAL' ? tipo : celda(1),
      razonSocial: celda(4),
      ruc,
      dni,
      domicilioFiscal: celda(5),
      representanteLegal: celda(6),
      actividadEconomica: celda(7),
      regimenTributarioId,
      fechaIncorporacion: fecha ?? '',
      responsableId: null,
    });

    if (!resultado.success) {
      errores.push(
        ...resultado.error.issues
          .filter((problema) => problema.path[0] !== 'fechaIncorporacion')
          .map((problema) =>
            problema.path[0] === 'tipoPersona' ? 'El tipo de persona debe ser NATURAL o JURIDICA.' : problema.message,
          ),
      );
    }

    const nombreContacto = celda(10);
    const correoContacto = celda(11).toLowerCase();

    if (correoContacto !== '' && !esquemaCorreo.safeParse(correoContacto).success) {
      errores.push('El correo del contacto no es válido.');
    }

    if (nombreContacto === '' && (correoContacto !== '' || celda(12) !== '')) {
      errores.push('Indique el nombre del contacto principal.');
    }

    return {
      numero,
      documento,
      entrada: errores.length === 0 && resultado.success ? resultado.data : null,
      contacto:
        nombreContacto === ''
          ? null
          : {
              nombre: nombreContacto,
              correo: correoContacto === '' ? null : correoContacto,
              telefono: celda(12) === '' ? null : celda(12),
            },
      errores,
    };
  }

  private describirError(error: unknown): string {
    const cuerpo = z
      .object({ response: z.object({ errores: z.array(z.object({ mensaje: z.string() })) }) })
      .safeParse(error);

    if (cuerpo.success && cuerpo.data.response.errores.length > 0) {
      return cuerpo.data.response.errores.map(({ mensaje }) => mensaje).join(' ');
    }

    return 'No se pudo registrar el cliente.';
  }
}
