import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  accionDeEnvio,
  ESTADOS_CERRADOS,
  ESTADOS_CON_AVANCE,
  estadoTrasAccion,
  type FiltroTareas,
  type MiTrabajo,
  type OpcionesTarea,
  type PaginaTareas,
  type TareaDetalle,
  type TareaResumen,
} from '@sige/types';
import type { UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb, aIso, aIsoONulo, fechaHoyEnLima } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { AccesoTareasService } from './task-access.service';
import { aResumenTarea, INCLUSION_RESUMEN_TAREA } from './task-mappers';

const DIAS_PROXIMAS = 7;

function sumarDias(fecha: string, dias: number): string {
  const resultado = aFechaDb(fecha);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado.toISOString().slice(0, 10);
}

function filtroEstado(estado: FiltroTareas['estado']): Prisma.TareaWhereInput {
  if (estado === undefined) {
    return {};
  }

  if (estado === 'ABIERTAS') {
    return { estado: { notIn: [...ESTADOS_CERRADOS] } };
  }

  if (estado === 'CERRADAS') {
    return { estado: { in: [...ESTADOS_CERRADOS] } };
  }

  return { estado };
}

@Injectable()
export class ConsultaTareasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoTareasService,
  ) {}

  async listar(filtro: FiltroTareas, usuario: UsuarioAutenticado): Promise<PaginaTareas> {
    const hoy = fechaHoyEnLima();
    const condiciones: Prisma.TareaWhereInput[] = [this.acceso.filtroVisible(usuario), filtroEstado(filtro.estado)];

    if (filtro.busqueda !== undefined) {
      condiciones.push({
        OR: [
          { titulo: { contains: filtro.busqueda, mode: 'insensitive' } },
          { codigo: { contains: filtro.busqueda, mode: 'insensitive' } },
        ],
      });
    }

    if (filtro.responsableId !== undefined) {
      condiciones.push({ responsableId: filtro.responsableId });
    }

    if (filtro.revisorId !== undefined) {
      condiciones.push({ revisorId: filtro.revisorId });
    }

    if (filtro.areaId !== undefined) {
      condiciones.push({ responsable: { trabajador: { areaId: filtro.areaId } } });
    }

    if (filtro.clienteId !== undefined) {
      condiciones.push({ clienteId: filtro.clienteId });
    }

    if (filtro.prioridad !== undefined) {
      condiciones.push({ prioridad: filtro.prioridad });
    }

    if (filtro.atrasadas !== undefined) {
      condiciones.push({ fechaLimite: { lt: aFechaDb(hoy) }, estado: { notIn: [...ESTADOS_CERRADOS] } });
    }

    if (filtro.desde !== undefined) {
      condiciones.push({ fechaLimite: { gte: aFechaDb(filtro.desde) } });
    }

    if (filtro.hasta !== undefined) {
      condiciones.push({ fechaLimite: { lte: aFechaDb(filtro.hasta) } });
    }

    const donde: Prisma.TareaWhereInput = { AND: condiciones };

    const [total, tareas] = await this.prisma.$transaction([
      this.prisma.tarea.count({ where: donde }),
      this.prisma.tarea.findMany({
        where: donde,
        orderBy: [{ fechaLimite: 'asc' }, { prioridad: 'desc' }, { codigo: 'asc' }],
        skip: (filtro.pagina - 1) * filtro.porPagina,
        take: filtro.porPagina,
        include: INCLUSION_RESUMEN_TAREA,
      }),
    ]);

    return {
      total,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
      elementos: tareas.map((tarea) => aResumenTarea(tarea, hoy)),
    };
  }

  async opciones(usuario: UsuarioAutenticado): Promise<OpcionesTarea> {
    const [usuarios, clientes] = await Promise.all([
      this.prisma.usuario.findMany({
        where: { activo: true },
        orderBy: { nombre: 'asc' },
        select: { id: true, nombre: true },
      }),
      this.prisma.cliente.findMany({
        where: {
          estado: { not: 'INACTIVO' },
          ...(usuario.alcanceGlobal
            ? {}
            : { asignaciones: { some: { usuarioId: usuario.usuarioId, retiradoEn: null } } }),
        },
        orderBy: { razonSocial: 'asc' },
        select: { id: true, razonSocial: true },
      }),
    ]);

    return { usuarios, clientes: clientes.map(({ id, razonSocial }) => ({ id, nombre: razonSocial })) };
  }

  async miTrabajo(usuario: UsuarioAutenticado): Promise<MiTrabajo> {
    const hoy = fechaHoyEnLima();
    const limiteProximas = sumarDias(hoy, DIAS_PROXIMAS);

    const [tareas, porRevisar] = await Promise.all([
      this.prisma.tarea.findMany({
        where: {
          estado: { notIn: [...ESTADOS_CERRADOS] },
          OR: [
            { responsableId: usuario.usuarioId },
            { colaboradores: { some: { usuarioId: usuario.usuarioId, retiradoEn: null } } },
          ],
        },
        orderBy: [{ fechaLimite: 'asc' }, { prioridad: 'desc' }],
        include: INCLUSION_RESUMEN_TAREA,
      }),
      this.prisma.tarea.count({ where: { revisorId: usuario.usuarioId, estado: 'EN_REVISION' } }),
    ]);

    const resumen = tareas.map((tarea) => aResumenTarea(tarea, hoy));
    const grupo = (condicion: (tarea: TareaResumen) => boolean): TareaResumen[] => resumen.filter(condicion);

    return {
      atrasadas: grupo((tarea) => tarea.fechaLimite < hoy),
      hoy: grupo((tarea) => tarea.fechaLimite === hoy),
      proximas: grupo((tarea) => tarea.fechaLimite > hoy && tarea.fechaLimite <= limiteProximas),
      posteriores: grupo((tarea) => tarea.fechaLimite > limiteProximas),
      porRevisar,
    };
  }

  async obtener(id: string, usuario: UsuarioAutenticado): Promise<TareaDetalle> {
    const hoy = fechaHoyEnLima();
    const tarea = await this.prisma.tarea.findUniqueOrThrow({
      where: { id },
      include: {
        ...INCLUSION_RESUMEN_TAREA,
        revisor: { select: { id: true, nombre: true } },
        asignadoPor: { select: { id: true, nombre: true } },
        colaboradores: {
          where: { retiradoEn: null },
          orderBy: { agregadoEn: 'asc' },
          include: { usuario: { select: { id: true, nombre: true } } },
        },
        avances: {
          orderBy: { registradoEn: 'desc' },
          include: {
            autor: { select: { id: true, nombre: true } },
            evidencias: { include: { archivo: true } },
          },
        },
        comentarios: { orderBy: { creadoEn: 'asc' }, include: { autor: { select: { id: true, nombre: true } } } },
        transiciones: { orderBy: { fecha: 'desc' }, include: { usuario: { select: { nombre: true } } } },
        rondas: { orderBy: { numero: 'desc' }, include: { revisor: { select: { id: true, nombre: true } } } },
        obligacion: { select: { id: true } },
        plantilla: { select: { id: true, nombre: true } },
        etapa: { select: { id: true, nombre: true, proyecto: { select: { id: true, codigo: true, nombre: true } } } },
        items: { orderBy: { orden: 'asc' }, include: { completadoPor: { select: { nombre: true } } } },
      },
    });

    const colaboradores = tarea.colaboradores.map(({ usuario: colaborador }) => colaborador);
    const participantes = new Map<string, { id: string; nombre: string }>();

    for (const persona of [tarea.responsable, tarea.asignadoPor, tarea.revisor, ...colaboradores]) {
      if (persona !== null) {
        participantes.set(persona.id, persona);
      }
    }

    const idsMencionados = [...new Set(tarea.comentarios.flatMap(({ mencionados }) => mencionados))];
    const mencionables = new Map(
      (
        await this.prisma.usuario.findMany({
          where: { id: { in: idsMencionados } },
          select: { id: true, nombre: true },
        })
      ).map((persona) => [persona.id, persona]),
    );

    const ejecuta =
      tarea.responsableId === usuario.usuarioId || colaboradores.some(({ id: colaboradorId }) => colaboradorId === usuario.usuarioId);
    const abierta = !ESTADOS_CERRADOS.includes(tarea.estado);
    const gestiona =
      usuario.permisos.has('tarea:crear') && (tarea.asignadoPorId === usuario.usuarioId || usuario.alcanceGlobal);

    return {
      ...aResumenTarea(tarea, hoy),
      instrucciones: tarea.instrucciones,
      revisor: tarea.revisor,
      asignadoPor: tarea.asignadoPor,
      colaboradores,
      requiereAprobacion: tarea.requiereAprobacion,
      requiereEvidencia: tarea.requiereEvidencia,
      evidenciaRequerida: tarea.evidenciaRequerida,
      minutosRegistrados: tarea.minutosRegistrados,
      version: tarea.version,
      creadoEn: aIso(tarea.creadoEn),
      obligacionId: tarea.obligacion?.id ?? null,
      plantilla: tarea.plantilla,
      etapa: tarea.etapa,
      items: tarea.items.map((item) => ({
        id: item.id,
        texto: item.texto,
        orden: item.orden,
        completado: item.completadoEn !== null,
        completadoPor: item.completadoPor?.nombre ?? null,
        completadoEn: aIsoONulo(item.completadoEn),
      })),
      avances: tarea.avances.map((avance) => ({
        id: avance.id,
        registradoEn: aIso(avance.registradoEn),
        autor: avance.autor,
        actividad: avance.actividad,
        descripcion: avance.descripcion,
        porcentaje: avance.porcentaje,
        minutosDedicados: avance.minutosDedicados,
        dificultades: avance.dificultades,
        observaciones: avance.observaciones,
        proximoPaso: avance.proximoPaso,
        corrigeAId: avance.corrigeAId,
        evidencias: avance.evidencias.map(({ archivo }) => ({
          id: archivo.id,
          nombre: archivo.nombreOriginal,
          mime: archivo.mime,
          tamanoBytes: archivo.tamanoBytes,
        })),
      })),
      comentarios: tarea.comentarios.map((comentario) => ({
        id: comentario.id,
        autor: comentario.autor,
        contenido: comentario.contenido,
        creadoEn: aIso(comentario.creadoEn),
        mencionados: comentario.mencionados.flatMap((mencionadoId) => {
          const persona = mencionables.get(mencionadoId);
          return persona === undefined ? [] : [persona];
        }),
      })),
      transiciones: tarea.transiciones.map((transicion) => ({
        id: transicion.id,
        desde: transicion.desde,
        hacia: transicion.hacia,
        usuario: transicion.usuario.nombre,
        comentario: transicion.comentario,
        fecha: aIso(transicion.fecha),
      })),
      participantes: [...participantes.values()],
      motivoCancelacion: tarea.motivoCancelacion,
      completadaEn: aIsoONulo(tarea.completadaEn),
      rondas: tarea.rondas.map((ronda) => ({
        id: ronda.id,
        numero: ronda.numero,
        revisor: ronda.revisor,
        decision: ronda.decision,
        comentario: ronda.comentario,
        fecha: aIso(ronda.fecha),
      })),
      evidenciasAdjuntas: tarea.avances.reduce((suma, avance) => suma + avance.evidencias.length, 0),
      acciones: {
        editar: abierta && gestiona,
        iniciar: tarea.estado === 'PENDIENTE' && ejecuta,
        registrarAvance: ESTADOS_CON_AVANCE.includes(tarea.estado) && ejecuta,
        comentar: true,
        enviar: accionDeEnvio(tarea.estado) !== null && ejecuta,
        revisar:
          tarea.estado === 'EN_REVISION' &&
          !ejecuta &&
          usuario.permisos.has('tarea:revisar') &&
          (tarea.revisorId === usuario.usuarioId || usuario.alcanceGlobal),
        finalizar: tarea.estado === 'APROBADA' && gestiona,
        cancelar: estadoTrasAccion(tarea.estado, 'CANCELAR', true) !== null && gestiona,
      },
    };
  }
}
