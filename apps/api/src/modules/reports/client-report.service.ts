import { Injectable } from '@nestjs/common';
import { ESTADOS_CERRADOS, ETIQUETAS_ESTADO_CLIENTE, type ReporteClientes } from '@sige/types';
import type { UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb, fechaHoyEnLima } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import type { TablaExportable } from './report-exporter';

@Injectable()
export class ReporteClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(usuario: UsuarioAutenticado, periodo: string): Promise<ReporteClientes> {
    const hoy = fechaHoyEnLima();
    const clientes = await this.prisma.cliente.findMany({
      where: usuario.alcanceGlobal
        ? {}
        : { asignaciones: { some: { usuarioId: usuario.usuarioId, retiradoEn: null } } },
      orderBy: [{ estado: 'asc' }, { razonSocial: 'asc' }],
      select: {
        razonSocial: true,
        ruc: true,
        dni: true,
        estado: true,
        regimenTributario: { select: { nombre: true } },
        obligaciones: {
          where: { activo: true },
          select: {
            periodos: {
              where: { periodo },
              select: { fechaVencimiento: true, fechaPresentacion: true, tarea: { select: { estado: true } } },
            },
          },
        },
        documentosEsperados: {
          where: { anuladoEn: null, documentoId: null, fechaLimite: { lt: aFechaDb(hoy) } },
          select: { id: true },
        },
        incidencias: { where: { estado: { in: ['ABIERTA', 'EN_ATENCION'] } }, select: { id: true } },
      },
    });

    return {
      periodo,
      filas: clientes.map((cliente) => {
        const generadas = cliente.obligaciones.flatMap(({ periodos }) => periodos);
        const cumplidas = generadas.filter(({ tarea }) => tarea.estado === 'APROBADA' || tarea.estado === 'FINALIZADA');
        const abiertas = generadas.filter(({ tarea }) => !ESTADOS_CERRADOS.includes(tarea.estado));

        return {
          cliente: cliente.razonSocial,
          documento: cliente.ruc ?? cliente.dni,
          estado: ETIQUETAS_ESTADO_CLIENTE[cliente.estado],
          regimen: cliente.regimenTributario?.nombre ?? null,
          obligacionesConfiguradas: cliente.obligaciones.length,
          cumplidas: cumplidas.length,
          pendientes: abiertas.length,
          vencidas: abiertas.filter(
            ({ fechaVencimiento, fechaPresentacion }) =>
              fechaPresentacion === null && fechaVencimiento.toISOString().slice(0, 10) < hoy,
          ).length,
          documentacionFaltante: cliente.documentosEsperados.length,
          incidenciasAbiertas: cliente.incidencias.length,
        };
      }),
    };
  }

  tabla(reporte: ReporteClientes, usuario: string, generadoEn: string): TablaExportable {
    const suma = (campo: 'obligacionesConfiguradas' | 'cumplidas' | 'pendientes' | 'vencidas' | 'documentacionFaltante' | 'incidenciasAbiertas'): number =>
      reporte.filas.reduce((total, fila) => total + fila[campo], 0);

    return {
      titulo: 'Reporte de clientes',
      filtros: [`Obligaciones del periodo ${reporte.periodo}`, `${String(reporte.filas.length)} clientes`],
      generadoPor: usuario,
      generadoEn,
      columnas: [
        { titulo: 'Cliente', ancho: 30 },
        { titulo: 'RUC o DNI', ancho: 13 },
        { titulo: 'Estado', ancho: 11 },
        { titulo: 'Régimen', ancho: 16 },
        { titulo: 'Obligaciones', ancho: 12, numerica: true },
        { titulo: 'Cumplidas', ancho: 10, numerica: true },
        { titulo: 'Pendientes', ancho: 10, numerica: true },
        { titulo: 'Vencidas', ancho: 10, numerica: true },
        { titulo: 'Doc. faltante', ancho: 12, numerica: true },
        { titulo: 'Incidencias', ancho: 11, numerica: true },
      ],
      filas: reporte.filas.map((fila) => [
        fila.cliente,
        fila.documento ?? '',
        fila.estado,
        fila.regimen ?? 'Sin régimen',
        fila.obligacionesConfiguradas,
        fila.cumplidas,
        fila.pendientes,
        fila.vencidas,
        fila.documentacionFaltante,
        fila.incidenciasAbiertas,
      ]),
      totales: [
        'Total',
        '',
        '',
        '',
        suma('obligacionesConfiguradas'),
        suma('cumplidas'),
        suma('pendientes'),
        suma('vencidas'),
        suma('documentacionFaltante'),
        suma('incidenciasAbiertas'),
      ],
    };
  }
}
