import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ESTADOS_CERRADOS, type HistorialTrabajador } from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb, aIso, fechaHoyEnLima, finDelDiaEnLima, inicioDelDiaEnLima } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
import { aResumenTarea, INCLUSION_RESUMEN_TAREA } from '../tasks/task-mappers';
import type { Periodo } from './indicators';
import { DatosReportesService } from './report-data.service';

const MAXIMO_REGISTROS = 100;

@Injectable()
export class HistorialTrabajadorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly datos: DatosReportesService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async obtener(
    usuarioId: string,
    periodo: Periodo,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<HistorialTrabajador> {
    const persona = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        nombre: true,
        trabajador: {
          select: {
            cargo: { select: { nombre: true } },
            area: { select: { nombre: true } },
            supervisor: { select: { usuarioId: true } },
          },
        },
      },
    });

    if (persona === null) {
      throw new NotFoundException({ mensaje: 'El usuario no existe.', errores: [] });
    }

    const esSupervisor = persona.trabajador?.supervisor?.usuarioId === usuario.usuarioId;

    if (usuarioId !== usuario.usuarioId && !usuario.alcanceGlobal && !esSupervisor) {
      await this.auditoria.registrar({
        actor: actorDesde(usuario, contexto),
        accion: 'PERMISO_DENEGADO',
        entidad: 'usuario',
        entidadId: usuarioId,
        motivo: 'Historial de un trabajador sin ser él mismo, su supervisor ni Gerencia',
      });

      throw new ForbiddenException({
        mensaje: 'El historial solo lo ven el propio trabajador, su supervisor y Gerencia.',
        errores: [],
      });
    }

    const hoy = fechaHoyEnLima();
    const inicio = inicioDelDiaEnLima(periodo.desde);
    const fin = finDelDiaEnLima(periodo.hasta);
    const alcanceTotal: UsuarioAutenticado = { ...usuario, alcance: 'GLOBAL', alcanceGlobal: true };

    const [datos, avances, tareas] = await Promise.all([
      this.datos.cargar(alcanceTotal, periodo, { usuarioId }),
      this.prisma.avance.findMany({
        where: { autorId: usuarioId, registradoEn: { gte: inicio, lte: fin } },
        orderBy: { registradoEn: 'desc' },
        take: MAXIMO_REGISTROS,
        select: {
          id: true,
          registradoEn: true,
          actividad: true,
          porcentaje: true,
          minutosDedicados: true,
          tarea: { select: { id: true, codigo: true, titulo: true } },
          _count: { select: { evidencias: true } },
        },
      }),
      this.prisma.tarea.findMany({
        where: {
          responsableId: usuarioId,
          OR: [
            { estado: { notIn: [...ESTADOS_CERRADOS] } },
            { completadaEn: { gte: inicio, lte: fin } },
            { fechaLimite: { gte: aFechaDb(periodo.desde), lte: aFechaDb(periodo.hasta) } },
          ],
        },
        orderBy: [{ fechaLimite: 'asc' }],
        take: MAXIMO_REGISTROS,
        include: INCLUSION_RESUMEN_TAREA,
      }),
    ]);

    return {
      desde: periodo.desde,
      hasta: periodo.hasta,
      usuario: { id: persona.id, nombre: persona.nombre },
      cargo: persona.trabajador?.cargo.nombre ?? null,
      area: persona.trabajador?.area.nombre ?? null,
      indicadores: this.datos.conteoDe(datos, usuarioId, periodo, hoy),
      avances: avances.map((avance) => ({
        id: avance.id,
        registradoEn: aIso(avance.registradoEn),
        tarea: avance.tarea,
        actividad: avance.actividad,
        porcentaje: avance.porcentaje,
        minutosDedicados: avance.minutosDedicados,
        evidencias: avance._count.evidencias,
      })),
      tareas: tareas.map((tarea) => aResumenTarea(tarea, hoy)),
    };
  }
}
