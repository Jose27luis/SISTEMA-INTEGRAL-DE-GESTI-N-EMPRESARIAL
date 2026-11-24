import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ESTADOS_CERRADOS, type FiltroPeriodo, type Tablero, type TareaResumen } from '@sige/types';
import type { UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb, fechaHoyEnLima } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { aResumenTarea, INCLUSION_RESUMEN_TAREA } from '../tasks/task-mappers';
import { calcularConteo } from './indicators';
import { DatosReportesService } from './report-data.service';

const MAXIMO_ALERTAS = 10;

@Injectable()
export class TableroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly datos: DatosReportesService,
  ) {}

  async obtener(usuario: UsuarioAutenticado, filtro: FiltroPeriodo): Promise<Tablero> {
    const hoy = fechaHoyEnLima();
    const periodo = { desde: filtro.desde, hasta: filtro.hasta };
    const visibles = this.datos.filtroTareas(usuario, filtro);
    const revisionPropia: Prisma.TareaWhereInput = usuario.alcanceGlobal ? {} : { revisorId: usuario.usuarioId };
    const verEquipo = usuario.permisos.has('reporte:personal');

    const alertas = (donde: Prisma.TareaWhereInput, orden: Prisma.TareaOrderByWithRelationInput[]): Promise<TareaResumen[]> =>
      this.prisma.tarea
        .findMany({ where: { AND: [visibles, donde] }, orderBy: orden, take: MAXIMO_ALERTAS, include: INCLUSION_RESUMEN_TAREA })
        .then((tareas) => tareas.map((tarea) => aResumenTarea(tarea, hoy)));

    const [datos, porRevisar, atrasadas, urgentes, enRevision, clientes, trabajadoresActivos] = await Promise.all([
      this.datos.cargar(usuario, periodo, filtro),
      this.prisma.tarea.count({ where: { AND: [visibles, revisionPropia, { estado: 'EN_REVISION' }] } }),
      alertas({ estado: { notIn: [...ESTADOS_CERRADOS] }, fechaLimite: { lt: aFechaDb(hoy) } }, [{ fechaLimite: 'asc' }]),
      alertas({ estado: 'PENDIENTE', prioridad: 'URGENTE' }, [{ fechaLimite: 'asc' }]),
      alertas({ AND: [revisionPropia, { estado: 'EN_REVISION' }] }, [{ actualizadoEn: 'asc' }]),
      usuario.permisos.has('cliente:ver') ? this.contarClientes(usuario, filtro) : Promise.resolve(null),
      verEquipo ? this.prisma.trabajador.count({ where: { estado: 'ACTIVO' } }) : Promise.resolve(null),
    ]);

    return {
      desde: filtro.desde,
      hasta: filtro.hasta,
      equipo: { ...calcularConteo(datos.tareas, datos.rondas, datos.minutos, periodo, hoy), porRevisar },
      clientes,
      trabajadoresActivos,
      carga: verEquipo
        ? this.datos
            .porPersona(datos, periodo, hoy)
            .sort((a, b) => b.atrasadas - a.atrasadas || b.abiertas - a.abiertas || a.usuario.nombre.localeCompare(b.usuario.nombre))
        : null,
      alertas: { atrasadas, urgentesSinIniciar: urgentes, porRevisar: enRevision },
    };
  }

  private async contarClientes(
    usuario: UsuarioAutenticado,
    filtro: FiltroPeriodo,
  ): Promise<{ activos: number; nuevos: number }> {
    const visibles: Prisma.ClienteWhereInput = usuario.alcanceGlobal
      ? {}
      : { asignaciones: { some: { usuarioId: usuario.usuarioId, retiradoEn: null } } };

    const [activos, nuevos] = await Promise.all([
      this.prisma.cliente.count({ where: { AND: [visibles, { estado: 'ACTIVO' }] } }),
      this.prisma.cliente.count({
        where: {
          AND: [visibles, { fechaIncorporacion: { gte: aFechaDb(filtro.desde), lte: aFechaDb(filtro.hasta) } }],
        },
      }),
    ]);

    return { activos, nuevos };
  }
}
