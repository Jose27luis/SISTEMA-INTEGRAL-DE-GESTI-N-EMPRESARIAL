import { BadRequestException, Injectable } from '@nestjs/common';
import { type CronogramaEntrada, type CronogramaPeriodo, ESTADOS_CERRADOS, type ListaCronograma } from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb, aFechaIso, aIso } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
import { ultimoDigitoRuc } from './obligation-rules';

@Injectable()
export class CronogramaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(anio: number): Promise<ListaCronograma> {
    const filas = await this.prisma.cronogramaVencimiento.findMany({
      where: { periodo: { startsWith: `${String(anio)}-` } },
      orderBy: [{ periodo: 'asc' }, { ultimoDigito: 'asc' }],
      include: {
        tipoObligacion: { select: { id: true, codigo: true, nombre: true } },
        cargadoPor: { select: { nombre: true } },
      },
    });
    const grupos = new Map<string, CronogramaPeriodo>();

    for (const fila of filas) {
      const clave = `${fila.tipoObligacionId}|${fila.periodo}|${fila.grupo}`;
      const actual = grupos.get(clave);
      const fecha = { ultimoDigito: fila.ultimoDigito, fechaVencimiento: aFechaIso(fila.fechaVencimiento) };

      if (actual === undefined) {
        grupos.set(clave, {
          tipoObligacion: fila.tipoObligacion,
          periodo: fila.periodo,
          grupo: fila.grupo,
          fuente: fila.fuente,
          fechas: [fecha],
          cargadoPor: fila.cargadoPor.nombre,
          actualizadoEn: aIso(fila.actualizadoEn),
        });
      } else {
        actual.fechas.push(fecha);

        if (aIso(fila.actualizadoEn) > actual.actualizadoEn) {
          actual.actualizadoEn = aIso(fila.actualizadoEn);
          actual.cargadoPor = fila.cargadoPor.nombre;
          actual.fuente = fila.fuente;
        }
      }
    }

    return {
      anio,
      cronogramas: [...grupos.values()].sort(
        (a, b) => a.periodo.localeCompare(b.periodo) || a.tipoObligacion.nombre.localeCompare(b.tipoObligacion.nombre),
      ),
    };
  }

  async guardar(entrada: CronogramaEntrada, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<number> {
    const tipo = await this.prisma.tipoObligacion.findUnique({
      where: { id: entrada.tipoObligacionId },
      select: { usaCronograma: true },
    });

    if (tipo === null || !tipo.usaCronograma) {
      throw new BadRequestException({
        mensaje: 'Revise los datos ingresados.',
        errores: [{ campo: 'tipoObligacionId', mensaje: 'Seleccione un tipo de obligación que use el cronograma oficial.' }],
      });
    }

    const fechaMinima = `${entrada.periodo}-01`;
    const tardias = entrada.fechas.filter(({ fechaVencimiento }) => fechaVencimiento < fechaMinima);

    if (tardias.length > 0) {
      throw new BadRequestException({
        mensaje: 'Revise las fechas del cronograma.',
        errores: [{ campo: 'fechas', mensaje: 'Las fechas de vencimiento no pueden ser anteriores al periodo.' }],
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const anteriores = await tx.cronogramaVencimiento.findMany({
        where: { tipoObligacionId: entrada.tipoObligacionId, periodo: entrada.periodo, grupo: entrada.grupo },
        select: { ultimoDigito: true, fechaVencimiento: true },
      });

      for (const { ultimoDigito, fechaVencimiento } of entrada.fechas) {
        await tx.cronogramaVencimiento.upsert({
          where: {
            tipoObligacionId_periodo_grupo_ultimoDigito: {
              tipoObligacionId: entrada.tipoObligacionId,
              periodo: entrada.periodo,
              grupo: entrada.grupo,
              ultimoDigito,
            },
          },
          create: {
            tipoObligacionId: entrada.tipoObligacionId,
            periodo: entrada.periodo,
            grupo: entrada.grupo,
            ultimoDigito,
            fechaVencimiento: aFechaDb(fechaVencimiento),
            fuente: entrada.fuente,
            cargadoPorId: usuario.usuarioId,
          },
          update: { fechaVencimiento: aFechaDb(fechaVencimiento), fuente: entrada.fuente, cargadoPorId: usuario.usuarioId },
        });
      }

      const fechaPorDigito = new Map(entrada.fechas.map(({ ultimoDigito, fechaVencimiento }) => [ultimoDigito, fechaVencimiento]));
      const generadas = await tx.obligacionPeriodo.findMany({
        where: {
          periodo: entrada.periodo,
          fechaPresentacion: null,
          tarea: { estado: { notIn: [...ESTADOS_CERRADOS] } },
          obligacionCliente: {
            tipoObligacionId: entrada.tipoObligacionId,
            cliente: { grupoCronograma: entrada.grupo },
          },
        },
        select: {
          id: true,
          tareaId: true,
          fechaVencimiento: true,
          obligacionCliente: { select: { cliente: { select: { ruc: true } } } },
        },
      });
      let reprogramadas = 0;

      for (const obligacion of generadas) {
        const digito = ultimoDigitoRuc(obligacion.obligacionCliente.cliente.ruc);
        const nueva = digito === null ? undefined : fechaPorDigito.get(digito);

        if (nueva === undefined || nueva === aFechaIso(obligacion.fechaVencimiento)) {
          continue;
        }

        await tx.obligacionPeriodo.update({ where: { id: obligacion.id }, data: { fechaVencimiento: aFechaDb(nueva) } });
        await tx.tarea.update({
          where: { id: obligacion.tareaId },
          data: { fechaLimite: aFechaDb(nueva), version: { increment: 1 } },
        });
        reprogramadas += 1;
      }

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: anteriores.length === 0 ? 'CREAR' : 'MODIFICAR',
          entidad: 'cronograma_vencimiento',
          entidadId: `${entrada.tipoObligacionId}:${entrada.periodo}:${entrada.grupo}`,
          ...(anteriores.length === 0
            ? {}
            : {
                antes: anteriores.map(({ ultimoDigito, fechaVencimiento }) => ({
                  ultimoDigito,
                  fechaVencimiento: aFechaIso(fechaVencimiento),
                })),
              }),
          despues: { fuente: entrada.fuente, fechas: entrada.fechas, obligacionesReprogramadas: reprogramadas },
        },
        tx,
      );

      return reprogramadas;
    });
  }
}
