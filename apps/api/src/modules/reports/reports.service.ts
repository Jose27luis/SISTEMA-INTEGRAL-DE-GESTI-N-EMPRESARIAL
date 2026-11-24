import { Injectable } from '@nestjs/common';
import type {
  ConteoTareas,
  FiltroPeriodo,
  IndicadoresArea,
  ReporteActividades,
  ReportePersonal,
} from '@sige/types';
import type { UsuarioAutenticado } from '../../common/auth/authenticated-request';
import {
  fechaEnLima,
  fechaHoyEnLima,
  finDelDiaEnLima,
  formatearFechaPeruana,
  horaEnLima,
  inicioDelDiaEnLima,
} from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { AccesoTareasService } from '../tasks/task-access.service';
import { calcularConteo, sumarConteos } from './indicators';
import { DatosReportesService } from './report-data.service';
import type { TablaExportable, ValorCelda } from './report-exporter';

const SIN_AREA = 'Sin área';
const MAXIMO_ACTIVIDADES = 5000;

function cumplimientoTexto(valor: number | null): string {
  return valor === null ? '—' : `${String(valor)} %`;
}

function horas(minutos: number): string {
  return (minutos / 60).toFixed(1);
}

function columnasConteo(conteo: ConteoTareas): ValorCelda[] {
  return [
    conteo.asignadas,
    conteo.terminadas,
    conteo.aprobadas,
    conteo.observadas,
    conteo.abiertas,
    conteo.atrasadas,
    horas(conteo.minutos),
    cumplimientoTexto(conteo.cumplimiento),
  ];
}

const COLUMNAS_CONTEO = [
  { titulo: 'Asignadas', ancho: 11, numerica: true },
  { titulo: 'Terminadas', ancho: 11, numerica: true },
  { titulo: 'Aprobadas', ancho: 11, numerica: true },
  { titulo: 'Observadas', ancho: 11, numerica: true },
  { titulo: 'Abiertas', ancho: 10, numerica: true },
  { titulo: 'Atrasadas', ancho: 10, numerica: true },
  { titulo: 'Horas', ancho: 9, numerica: true },
  { titulo: 'Cumplimiento', ancho: 13, numerica: true },
];

@Injectable()
export class ReportesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly datos: DatosReportesService,
    private readonly acceso: AccesoTareasService,
  ) {}

  async personal(usuario: UsuarioAutenticado, filtro: FiltroPeriodo): Promise<ReportePersonal> {
    const hoy = fechaHoyEnLima();
    const periodo = { desde: filtro.desde, hasta: filtro.hasta };
    const datos = await this.datos.cargar(usuario, periodo, filtro);
    const personas = this.datos.porPersona(datos, periodo, hoy);
    const nombresArea = [...new Set(personas.map(({ area }) => area ?? SIN_AREA))].sort((a, b) => a.localeCompare(b));

    const areas: IndicadoresArea[] = nombresArea.map((area) => {
      const integrantes = new Set(personas.filter((persona) => (persona.area ?? SIN_AREA) === area).map(({ usuario: u }) => u.id));
      const conteo = calcularConteo(
        datos.tareas.filter(({ responsableId }) => integrantes.has(responsableId)),
        datos.rondas.filter(({ responsableId }) => integrantes.has(responsableId)),
        datos.minutos.filter(({ autorId }) => integrantes.has(autorId)),
        periodo,
        hoy,
      );

      return { area, personas: integrantes.size, ...conteo };
    });

    return {
      desde: filtro.desde,
      hasta: filtro.hasta,
      area: await this.nombreArea(filtro.areaId),
      personas,
      areas,
      total: sumarConteos(
        personas,
        calcularConteo(datos.tareas, datos.rondas, datos.minutos, periodo, hoy).cumplimiento,
      ),
    };
  }

  async actividades(usuario: UsuarioAutenticado, filtro: FiltroPeriodo): Promise<ReporteActividades> {
    const avances = await this.prisma.avance.findMany({
      where: {
        registradoEn: { gte: inicioDelDiaEnLima(filtro.desde), lte: finDelDiaEnLima(filtro.hasta) },
        tarea: this.acceso.filtroVisible(usuario),
        ...(filtro.usuarioId === undefined ? {} : { autorId: filtro.usuarioId }),
        ...(filtro.areaId === undefined ? {} : { autor: { trabajador: { areaId: filtro.areaId } } }),
      },
      orderBy: [{ registradoEn: 'asc' }],
      take: MAXIMO_ACTIVIDADES,
      select: {
        registradoEn: true,
        actividad: true,
        porcentaje: true,
        minutosDedicados: true,
        autor: { select: { nombre: true, trabajador: { select: { area: { select: { nombre: true } } } } } },
        tarea: { select: { codigo: true, titulo: true, cliente: { select: { razonSocial: true } } } },
      },
    });

    const usuarioFiltrado =
      filtro.usuarioId === undefined
        ? null
        : ((await this.prisma.usuario.findUnique({ where: { id: filtro.usuarioId }, select: { nombre: true } }))?.nombre ??
          null);

    return {
      desde: filtro.desde,
      hasta: filtro.hasta,
      area: await this.nombreArea(filtro.areaId),
      usuario: usuarioFiltrado,
      filas: avances.map((avance) => ({
        fecha: fechaEnLima(avance.registradoEn),
        hora: horaEnLima(avance.registradoEn),
        usuario: avance.autor.nombre,
        area: avance.autor.trabajador?.area.nombre ?? null,
        tareaCodigo: avance.tarea.codigo,
        tareaTitulo: avance.tarea.titulo,
        cliente: avance.tarea.cliente?.razonSocial ?? null,
        actividad: avance.actividad,
        porcentaje: avance.porcentaje,
        minutos: avance.minutosDedicados,
      })),
      totalMinutos: avances.reduce((suma, avance) => suma + avance.minutosDedicados, 0),
    };
  }

  tablaPersonal(reporte: ReportePersonal, usuario: string, generadoEn: string): TablaExportable {
    return {
      titulo: 'Reporte de personal: cumplimiento por trabajador',
      filtros: [
        `Periodo: ${formatearFechaPeruana(reporte.desde)} al ${formatearFechaPeruana(reporte.hasta)}`,
        `Área: ${reporte.area ?? 'Todas'}`,
      ],
      generadoPor: usuario,
      generadoEn,
      columnas: [{ titulo: 'Trabajador', ancho: 28 }, { titulo: 'Área', ancho: 18 }, ...COLUMNAS_CONTEO],
      filas: [
        ...reporte.personas.map((persona) => [persona.usuario.nombre, persona.area ?? SIN_AREA, ...columnasConteo(persona)]),
        ...reporte.areas.map((area) => [
          `Subtotal ${area.area}`,
          `${String(area.personas)} ${area.personas === 1 ? 'persona' : 'personas'}`,
          ...columnasConteo(area),
        ]),
      ],
      totales: ['Total', '', ...columnasConteo(reporte.total)],
    };
  }

  tablaActividades(reporte: ReporteActividades, usuario: string, generadoEn: string): TablaExportable {
    return {
      titulo: 'Reporte de actividades por trabajador',
      filtros: [
        `Periodo: ${formatearFechaPeruana(reporte.desde)} al ${formatearFechaPeruana(reporte.hasta)}`,
        `Área: ${reporte.area ?? 'Todas'} · Trabajador: ${reporte.usuario ?? 'Todos'}`,
      ],
      generadoPor: usuario,
      generadoEn,
      columnas: [
        { titulo: 'Fecha', ancho: 11 },
        { titulo: 'Hora', ancho: 7 },
        { titulo: 'Trabajador', ancho: 22 },
        { titulo: 'Tarea', ancho: 14 },
        { titulo: 'Cliente', ancho: 24 },
        { titulo: 'Actividad', ancho: 34 },
        { titulo: 'Avance', ancho: 9, numerica: true },
        { titulo: 'Minutos', ancho: 9, numerica: true },
      ],
      filas: reporte.filas.map((fila) => [
        formatearFechaPeruana(fila.fecha),
        fila.hora,
        fila.usuario,
        fila.tareaCodigo,
        fila.cliente ?? 'Interna',
        fila.actividad,
        `${String(fila.porcentaje)} %`,
        fila.minutos,
      ]),
      totales: ['Total', '', '', '', '', `${String(reporte.filas.length)} registros`, '', reporte.totalMinutos],
    };
  }

  async nombreUsuario(usuarioId: string): Promise<string> {
    return (await this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { nombre: true } }))?.nombre ?? '';
  }

  private async nombreArea(areaId: string | undefined): Promise<string | null> {
    if (areaId === undefined) {
      return null;
    }

    return (await this.prisma.area.findUnique({ where: { id: areaId }, select: { nombre: true } }))?.nombre ?? null;
  }
}
