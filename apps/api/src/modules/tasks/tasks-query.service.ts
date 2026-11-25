import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  accionDeEnvio,
  type CargaEquipo,
  type CargaPersona,
  DIAS_CALENDARIO_CARGA,
  DIAS_POR_VENCER,
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
import { aFechaDb, aFechaIso, aIso, aIsoONulo, fechaHoyEnLima, horaEnLima } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { AccesoTareasService } from './task-access.service';
import { aResumenTarea, INCLUSION_RESUMEN_TAREA } from './task-mappers';
import { armarPasos, evaluarSeguimiento } from './task-tracking-rules';

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
      condiciones.push({
        estado: { notIn: [...ESTADOS_CERRADOS] },
        OR: [
          { fechaLimite: { lt: aFechaDb(hoy) } },
          { fechaLimite: aFechaDb(hoy), horaLimite: { lt: horaEnLima(new Date()) } },
        ],
      });
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
        orderBy: [
          { fechaLimite: 'asc' },
          { horaLimite: { sort: 'asc', nulls: 'last' } },
          { prioridad: 'desc' },
          { codigo: 'asc' },
        ],
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

  async cargaEquipo(): Promise<CargaEquipo> {
    const hoy = fechaHoyEnLima();
    const limitePorVencer = sumarDias(hoy, DIAS_POR_VENCER);
    const limiteCalendario = sumarDias(hoy, DIAS_CALENDARIO_CARGA);
    const [usuarios, abiertas] = await Promise.all([
      this.prisma.usuario.findMany({
        where: { activo: true },
        orderBy: { nombre: 'asc' },
        select: { id: true, nombre: true },
      }),
      this.prisma.tarea.findMany({
        where: { estado: { notIn: [...ESTADOS_CERRADOS] } },
        select: {
          responsableId: true,
          fechaLimite: true,
          prioridad: true,
          estado: true,
          seguimientoEstricto: true,
          recibidaEn: true,
        },
      }),
    ]);
    const cargas = new Map<string, CargaPersona & { dias: Map<string, number> }>(
      usuarios.map((persona) => [
        persona.id,
        { ...persona, abiertas: 0, vencidas: 0, porVencer: 0, urgentes: 0, porConfirmar: 0, vencimientos: [], dias: new Map() },
      ]),
    );

    for (const tarea of abiertas) {
      const carga = cargas.get(tarea.responsableId);

      if (carga === undefined) {
        continue;
      }

      const fecha = aFechaIso(tarea.fechaLimite);
      carga.abiertas += 1;
      carga.vencidas += fecha < hoy ? 1 : 0;
      carga.porVencer += fecha >= hoy && fecha <= limitePorVencer ? 1 : 0;
      carga.urgentes += tarea.prioridad === 'URGENTE' ? 1 : 0;
      carga.porConfirmar += tarea.seguimientoEstricto && tarea.estado === 'PENDIENTE' && tarea.recibidaEn === null ? 1 : 0;

      if (fecha >= hoy && fecha <= limiteCalendario) {
        carga.dias.set(fecha, (carga.dias.get(fecha) ?? 0) + 1);
      }
    }

    return {
      hoy,
      personas: [...cargas.values()].map(({ dias, ...carga }) => ({
        ...carga,
        vencimientos: [...dias.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([fecha, cantidad]) => ({ fecha, cantidad })),
      })),
    };
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
        orderBy: [{ fechaLimite: 'asc' }, { horaLimite: { sort: 'asc', nulls: 'last' } }, { prioridad: 'desc' }],
        include: INCLUSION_RESUMEN_TAREA,
      }),
      this.prisma.tarea.count({ where: { revisorId: usuario.usuarioId, estado: 'EN_REVISION' } }),
    ]);

    const resumen = tareas.map((tarea) => aResumenTarea(tarea, hoy));
    const grupo = (condicion: (tarea: TareaResumen) => boolean): TareaResumen[] => resumen.filter(condicion);

    return {
      atrasadas: grupo((tarea) => tarea.atrasada),
      hoy: grupo((tarea) => tarea.fechaLimite === hoy && !tarea.atrasada),
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
        adjuntos: {
          orderBy: { agregadoEn: 'asc' },
          include: { archivo: true, agregadoPor: { select: { nombre: true } } },
        },
        prorrogas: {
          orderBy: { solicitadaEn: 'desc' },
          include: { solicitadaPor: { select: { nombre: true } }, resueltaPor: { select: { nombre: true } } },
        },
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
    const evidenciasAdjuntas = tarea.avances.reduce((suma, avance) => suma + avance.evidencias.length, 0);
    const estadoSeguimiento = evaluarSeguimiento(
      {
        estado: tarea.estado,
        prioridad: tarea.prioridad,
        fechaLimite: aFechaIso(tarea.fechaLimite),
        horaLimite: tarea.horaLimite,
        estricto: tarea.seguimientoEstricto,
        creadoEn: tarea.creadoEn,
        recibidaEn: tarea.recibidaEn,
        ultimoReporteEn: tarea.ultimoReporteEn,
      },
      new Date(),
      hoy,
    );

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
      adjuntos: tarea.adjuntos.map(({ archivo, agregadoPor, agregadoEn }) => ({
        id: archivo.id,
        nombre: archivo.nombreOriginal,
        mime: archivo.mime,
        tamanoBytes: archivo.tamanoBytes,
        agregadoPor: agregadoPor.nombre,
        agregadoEn: aIso(agregadoEn),
      })),
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
      evidenciasAdjuntas,
      seguimiento: {
        estricto: tarea.seguimientoEstricto,
        semaforo: estadoSeguimiento.semaforo,
        recibidaEn: aIsoONulo(tarea.recibidaEn),
        esperandoAcuse: estadoSeguimiento.esperandoAcuse,
        sinAcuse: estadoSeguimiento.sinAcuse,
        ultimoReporte: aIsoONulo(tarea.ultimoReporteEn),
        limiteReporte: estadoSeguimiento.limiteReporte,
        sinReporte: estadoSeguimiento.sinReporte,
        rondasObservadas: tarea.rondas.filter(({ decision }) => decision === 'OBSERVADA').length,
        pasos: armarPasos(
          {
            estado: tarea.estado,
            estricto: tarea.seguimientoEstricto,
            requiereAprobacion: tarea.requiereAprobacion,
            creadoEn: tarea.creadoEn,
            asignadoPor: tarea.asignadoPor.nombre,
            recibidaEn: tarea.recibidaEn,
            responsable: tarea.responsable.nombre,
          },
          tarea.transiciones.map((transicion) => ({
            hacia: transicion.hacia,
            fecha: transicion.fecha,
            usuario: transicion.usuario.nombre,
          })),
          new Date(),
        ),
        prorrogas: tarea.prorrogas.map((prorroga) => ({
          id: prorroga.id,
          fechaAnterior: aFechaIso(prorroga.fechaAnterior),
          horaAnterior: prorroga.horaAnterior,
          fechaPropuesta: aFechaIso(prorroga.fechaPropuesta),
          horaPropuesta: prorroga.horaPropuesta,
          motivo: prorroga.motivo,
          estado: prorroga.estado,
          solicitadaPor: prorroga.solicitadaPor.nombre,
          solicitadaEn: aIso(prorroga.solicitadaEn),
          resueltaPor: prorroga.resueltaPor?.nombre ?? null,
          resueltaEn: aIsoONulo(prorroga.resueltaEn),
          respuesta: prorroga.respuesta,
        })),
        acciones: {
          acusar: estadoSeguimiento.esperandoAcuse && tarea.responsableId === usuario.usuarioId,
          solicitarProrroga:
            tarea.seguimientoEstricto && abierta && ejecuta && !tarea.prorrogas.some(({ estado }) => estado === 'PENDIENTE'),
          resolverProrroga:
            tarea.prorrogas.some(({ estado }) => estado === 'PENDIENTE') &&
            (tarea.asignadoPorId === usuario.usuarioId || usuario.alcanceGlobal),
        },
        requisitosEnvio: tarea.seguimientoEstricto
          ? [
              { texto: 'Avance al 100 %', cumplido: tarea.porcentajeAvance === 100 },
              ...(tarea.items.length === 0
                ? []
                : [
                    {
                      texto: `Lista de verificación completa (${String(tarea.items.filter(({ completadoEn }) => completadoEn !== null).length)} de ${String(tarea.items.length)})`,
                      cumplido: tarea.items.every(({ completadoEn }) => completadoEn !== null),
                    },
                  ]),
              ...(tarea.requiereEvidencia ? [{ texto: 'Evidencia adjunta', cumplido: evidenciasAdjuntas > 0 }] : []),
            ]
          : [],
      },
      acciones: {
        editar: abierta && gestiona,
        iniciar: tarea.estado === 'PENDIENTE' && ejecuta && !estadoSeguimiento.esperandoAcuse,
        registrarAvance: ESTADOS_CON_AVANCE.includes(tarea.estado) && ejecuta && !estadoSeguimiento.esperandoAcuse,
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
