import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { type ConteoTareas, ESTADOS_CERRADOS, type IndicadoresPersona } from '@sige/types';
import type { UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb, aFechaIso, fechaEnLima, finDelDiaEnLima, inicioDelDiaEnLima } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { AccesoTareasService } from '../tasks/task-access.service';
import {
  calcularConteo,
  type MinutosIndicador,
  type Periodo,
  type RondaIndicador,
  type TareaIndicador,
} from './indicators';

export interface FiltroPersonas {
  areaId?: string | undefined;
  usuarioId?: string | undefined;
}

export interface PersonaReporte {
  id: string;
  nombre: string;
  area: string | null;
  activo: boolean;
}

export interface DatosIndicadores {
  tareas: TareaIndicador[];
  rondas: RondaIndicador[];
  minutos: MinutosIndicador[];
  personas: PersonaReporte[];
}

export function filtroResponsable(filtro: FiltroPersonas): Prisma.TareaWhereInput {
  return {
    ...(filtro.usuarioId === undefined ? {} : { responsableId: filtro.usuarioId }),
    ...(filtro.areaId === undefined ? {} : { responsable: { trabajador: { areaId: filtro.areaId } } }),
  };
}

function filtroAutor(filtro: FiltroPersonas): Prisma.AvanceWhereInput {
  return {
    ...(filtro.usuarioId === undefined ? {} : { autorId: filtro.usuarioId }),
    ...(filtro.areaId === undefined ? {} : { autor: { trabajador: { areaId: filtro.areaId } } }),
  };
}

@Injectable()
export class DatosReportesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoTareasService,
  ) {}

  filtroTareas(usuario: UsuarioAutenticado, filtro: FiltroPersonas): Prisma.TareaWhereInput {
    return { AND: [this.acceso.filtroVisible(usuario), filtroResponsable(filtro)] };
  }

  async cargar(usuario: UsuarioAutenticado, periodo: Periodo, filtro: FiltroPersonas): Promise<DatosIndicadores> {
    const inicio = inicioDelDiaEnLima(periodo.desde);
    const fin = finDelDiaEnLima(periodo.hasta);
    const visibles = this.filtroTareas(usuario, filtro);

    const [tareas, rondas, minutos, trabajadores] = await Promise.all([
      this.prisma.tarea.findMany({
        where: {
          AND: [
            visibles,
            {
              OR: [
                { creadoEn: { gte: inicio, lte: fin } },
                { completadaEn: { gte: inicio, lte: fin } },
                { fechaLimite: { gte: aFechaDb(periodo.desde), lte: aFechaDb(periodo.hasta) } },
                { estado: { notIn: [...ESTADOS_CERRADOS] } },
              ],
            },
          ],
        },
        select: { responsableId: true, estado: true, fechaLimite: true, creadoEn: true, completadaEn: true },
      }),
      this.prisma.rondaRevision.findMany({
        where: { fecha: { gte: inicio, lte: fin }, tarea: visibles },
        select: { decision: true, fecha: true, tarea: { select: { responsableId: true } } },
      }),
      this.prisma.avance.groupBy({
        by: ['autorId'],
        where: {
          AND: [{ registradoEn: { gte: inicio, lte: fin } }, { tarea: this.acceso.filtroVisible(usuario) }, filtroAutor(filtro)],
        },
        _sum: { minutosDedicados: true },
      }),
      usuario.alcanceGlobal
        ? this.prisma.trabajador.findMany({
            where: {
              estado: 'ACTIVO',
              ...(filtro.areaId === undefined ? {} : { areaId: filtro.areaId }),
              ...(filtro.usuarioId === undefined ? {} : { usuarioId: filtro.usuarioId }),
            },
            select: { usuarioId: true },
          })
        : Promise.resolve([]),
    ]);

    const ids = new Set([
      ...tareas.map(({ responsableId }) => responsableId),
      ...minutos.map(({ autorId }) => autorId),
      ...trabajadores.map(({ usuarioId }) => usuarioId),
    ]);
    const usuarios = await this.prisma.usuario.findMany({
      where: { id: { in: [...ids] } },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, activo: true, trabajador: { select: { area: { select: { nombre: true } } } } },
    });

    return {
      tareas: tareas.map((tarea) => ({
        responsableId: tarea.responsableId,
        estado: tarea.estado,
        fechaLimite: aFechaIso(tarea.fechaLimite),
        creadaEl: fechaEnLima(tarea.creadoEn),
        completadaEl: tarea.completadaEn === null ? null : fechaEnLima(tarea.completadaEn),
      })),
      rondas: rondas.map((ronda) => ({
        responsableId: ronda.tarea.responsableId,
        decision: ronda.decision,
        fecha: fechaEnLima(ronda.fecha),
      })),
      minutos: minutos.map((registro) => ({ autorId: registro.autorId, minutos: registro._sum.minutosDedicados ?? 0 })),
      personas: usuarios.map((persona) => ({
        id: persona.id,
        nombre: persona.nombre,
        area: persona.trabajador?.area.nombre ?? null,
        activo: persona.activo,
      })),
    };
  }

  conteoDe(datos: DatosIndicadores, personaId: string, periodo: Periodo, hoy: string): ConteoTareas {
    return calcularConteo(
      datos.tareas.filter(({ responsableId }) => responsableId === personaId),
      datos.rondas.filter(({ responsableId }) => responsableId === personaId),
      datos.minutos.filter(({ autorId }) => autorId === personaId),
      periodo,
      hoy,
    );
  }

  porPersona(datos: DatosIndicadores, periodo: Periodo, hoy: string): IndicadoresPersona[] {
    return datos.personas.map((persona) => ({
      usuario: { id: persona.id, nombre: persona.nombre },
      area: persona.area,
      ...this.conteoDe(datos, persona.id, periodo, hoy),
    }));
  }
}
