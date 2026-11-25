import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ESTADOS_PROYECTO_CERRADOS,
  estaAtrasada,
  type EstadoProyecto,
  type FiltroProyectos,
  type IndicadoresProyectos,
  type OpcionesProyecto,
  type PaginaProyectos,
  type ProyectoDetalle,
  type ProyectoResumen,
  PROYECTOS_POR_PAGINA,
  TRANSICIONES_PROYECTO,
} from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb, aFechaIso, aFechaIsoONula, aIso, aIsoONulo, fechaHoyEnLima } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
import { AccesoClientesService } from '../clients/client-access.service';
import { avanceDeTareas, proyectoAtrasado } from './project-rules';
import { filtroProyectosVisibles } from './project-visibility';

const INCLUSION_RESUMEN = {
  cliente: { select: { id: true, razonSocial: true } },
  responsable: { select: { id: true, nombre: true } },
  etapas: { select: { tareas: { select: { estado: true, porcentajeAvance: true } } } },
} satisfies Prisma.ProyectoInclude;

type ProyectoConResumen = Prisma.ProyectoGetPayload<{ include: typeof INCLUSION_RESUMEN }>;

export interface ProyectoAccesible {
  id: string;
  estado: EstadoProyecto;
  clienteId: string | null;
  responsableId: string;
  nombre: string;
  codigo: string;
  equipo: Set<string>;
}

function aResumen(proyecto: ProyectoConResumen, hoy: string): ProyectoResumen {
  const tareas = proyecto.etapas.flatMap((etapa) => etapa.tareas);
  const fechaEntrega = aFechaIso(proyecto.fechaEntrega);

  return {
    id: proyecto.id,
    codigo: proyecto.codigo,
    nombre: proyecto.nombre,
    cliente: proyecto.cliente,
    responsable: proyecto.responsable,
    estado: proyecto.estado,
    fechaInicio: aFechaIso(proyecto.fechaInicio),
    fechaEntrega,
    avance: avanceDeTareas(tareas),
    tareas: tareas.filter(({ estado }) => estado !== 'CANCELADA').length,
    conDificultades: proyecto.conDificultades,
    detalleDificultad: proyecto.detalleDificultad,
    atrasado: proyectoAtrasado(proyecto.estado, fechaEntrega, hoy),
  };
}

@Injectable()
export class ConsultaProyectosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly accesoClientes: AccesoClientesService,
  ) {}

  async listar(filtro: FiltroProyectos, usuario: UsuarioAutenticado): Promise<PaginaProyectos> {
    const condiciones: Prisma.ProyectoWhereInput[] = [filtroProyectosVisibles(usuario)];

    if (filtro.busqueda !== undefined) {
      condiciones.push({
        OR: [
          { nombre: { contains: filtro.busqueda, mode: 'insensitive' } },
          { codigo: { contains: filtro.busqueda, mode: 'insensitive' } },
        ],
      });
    }

    if (filtro.clienteId !== undefined) {
      condiciones.push({ clienteId: filtro.clienteId });
    }

    if (filtro.responsableId !== undefined) {
      condiciones.push({ responsableId: filtro.responsableId });
    }

    if (filtro.estado !== undefined) {
      condiciones.push({ estado: filtro.estado });
    }

    if (filtro.dificultades === 'si') {
      condiciones.push({ conDificultades: true });
    }

    const where: Prisma.ProyectoWhereInput = { AND: condiciones };
    const hoy = fechaHoyEnLima();
    const [total, proyectos] = await Promise.all([
      this.prisma.proyecto.count({ where }),
      this.prisma.proyecto.findMany({
        where,
        include: INCLUSION_RESUMEN,
        orderBy: [{ conDificultades: 'desc' }, { fechaEntrega: 'asc' }],
        skip: (filtro.pagina - 1) * PROYECTOS_POR_PAGINA,
        take: PROYECTOS_POR_PAGINA,
      }),
    ]);

    return {
      total,
      pagina: filtro.pagina,
      porPagina: PROYECTOS_POR_PAGINA,
      elementos: proyectos.map((proyecto) => aResumen(proyecto, hoy)),
    };
  }

  async obtenerVisible(id: string, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<ProyectoAccesible> {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        estado: true,
        clienteId: true,
        responsableId: true,
        miembros: { where: { retiradoEn: null }, select: { usuarioId: true } },
      },
    });

    if (proyecto === null) {
      throw new NotFoundException({ mensaje: 'El proyecto no existe.', errores: [] });
    }

    const visible = await this.prisma.proyecto.count({ where: { AND: [{ id }, filtroProyectosVisibles(usuario)] } });

    if (visible === 0) {
      await this.auditoria.registrar({
        actor: actorDesde(usuario, contexto),
        accion: 'PERMISO_DENEGADO',
        entidad: 'proyecto',
        entidadId: id,
        motivo: 'Proyecto fuera del alcance del usuario',
      });

      throw new ForbiddenException({ mensaje: 'No tiene acceso a este proyecto.', errores: [] });
    }

    return {
      id: proyecto.id,
      codigo: proyecto.codigo,
      nombre: proyecto.nombre,
      estado: proyecto.estado,
      clienteId: proyecto.clienteId,
      responsableId: proyecto.responsableId,
      equipo: new Set([proyecto.responsableId, ...proyecto.miembros.map(({ usuarioId }) => usuarioId)]),
    };
  }

  async detalle(id: string, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<ProyectoDetalle> {
    const accesible = await this.obtenerVisible(id, usuario, contexto);
    const hoy = fechaHoyEnLima();
    const [proyecto, egresos] = await Promise.all([
      this.prisma.proyecto.findUniqueOrThrow({
        where: { id },
        include: {
          ...INCLUSION_RESUMEN,
          servicio: { select: { id: true, nombre: true } },
          creadoPor: { select: { nombre: true } },
          miembros: {
            where: { retiradoEn: null },
            orderBy: { agregadoEn: 'asc' },
            select: { usuario: { select: { id: true, nombre: true } } },
          },
          etapas: {
            orderBy: { orden: 'asc' },
            include: {
              tareas: {
                orderBy: [{ fechaLimite: 'asc' }, { codigo: 'asc' }],
                select: {
                  id: true,
                  codigo: true,
                  titulo: true,
                  estado: true,
                  fechaInicio: true,
                  fechaLimite: true,
                  porcentajeAvance: true,
                  responsable: { select: { id: true, nombre: true } },
                },
              },
              entregables: {
                orderBy: [{ fechaCompromiso: 'asc' }, { creadoEn: 'asc' }],
                include: {
                  archivo: { select: { id: true, nombreOriginal: true } },
                  entregadoPor: { select: { nombre: true } },
                  revisadoPor: { select: { nombre: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.egreso.aggregate({ where: { proyectoId: id, anuladoEn: null }, _sum: { importe: true } }),
    ]);
    const abierto = !ESTADOS_PROYECTO_CERRADOS.includes(proyecto.estado);
    const gestiona = usuario.alcanceGlobal || proyecto.responsableId === usuario.usuarioId;
    const enEquipo = accesible.equipo.has(usuario.usuarioId);

    return {
      ...aResumen(proyecto, hoy),
      servicio: proyecto.servicio,
      descripcion: proyecto.descripcion,
      objetivo: proyecto.objetivo,
      presupuesto: proyecto.presupuesto === null ? null : Number(proyecto.presupuesto),
      honorarios: proyecto.honorarios === null ? null : Number(proyecto.honorarios),
      egresos: Number(egresos._sum.importe ?? 0),
      resultadoFinal: proyecto.resultadoFinal,
      miembros: proyecto.miembros.map(({ usuario: miembro }) => miembro),
      etapas: proyecto.etapas.map((etapa) => ({
        id: etapa.id,
        nombre: etapa.nombre,
        orden: etapa.orden,
        inicio: aFechaIso(etapa.inicio),
        fin: aFechaIso(etapa.fin),
        estado: etapa.estado,
        avance: avanceDeTareas(etapa.tareas),
        entregables: etapa.entregables.map((entregable) => {
          const compromiso = aFechaIso(entregable.fechaCompromiso);

          return {
            id: entregable.id,
            nombre: entregable.nombre,
            fechaCompromiso: compromiso,
            estado: entregable.estado,
            archivo: entregable.archivo === null ? null : { id: entregable.archivo.id, nombre: entregable.archivo.nombreOriginal },
            entregadoPor: entregable.entregadoPor?.nombre ?? null,
            entregadoEn: aIsoONulo(entregable.entregadoEn),
            revisadoPor: entregable.revisadoPor?.nombre ?? null,
            revisadoEn: aIsoONulo(entregable.revisadoEn),
            comentario: entregable.comentario,
            vencido: entregable.estado !== 'APROBADO' && compromiso < hoy,
          };
        }),
      })),
      tareasDetalle: proyecto.etapas.flatMap((etapa) =>
        etapa.tareas.map((tarea) => {
          const fechaLimite = aFechaIso(tarea.fechaLimite);

          return {
            id: tarea.id,
            codigo: tarea.codigo,
            titulo: tarea.titulo,
            estado: tarea.estado,
            responsable: tarea.responsable,
            fechaInicio: aFechaIsoONula(tarea.fechaInicio),
            fechaLimite,
            porcentajeAvance: tarea.porcentajeAvance,
            atrasada: estaAtrasada(tarea.estado, fechaLimite, hoy),
            etapaId: etapa.id,
          };
        }),
      ),
      creadoPor: proyecto.creadoPor.nombre,
      creadoEn: aIso(proyecto.creadoEn),
      permisos: {
        editar: abierto && gestiona,
        crearTareas: abierto && usuario.permisos.has('tarea:crear') && (usuario.alcanceGlobal || enEquipo),
        entregar: abierto && (usuario.alcanceGlobal || enEquipo),
        aprobar: gestiona,
        transiciones: gestiona ? [...TRANSICIONES_PROYECTO[proyecto.estado]] : [],
      },
    };
  }

  async opciones(usuario: UsuarioAutenticado): Promise<OpcionesProyecto> {
    const [clientes, servicios, usuarios] = await Promise.all([
      this.prisma.cliente.findMany({
        where: { AND: [{ estado: { not: 'INACTIVO' } }, this.accesoClientes.filtroVisible(usuario)] },
        orderBy: { razonSocial: 'asc' },
        select: { id: true, razonSocial: true },
      }),
      this.prisma.servicio.findMany({
        where: { activo: true },
        orderBy: [{ tipo: 'desc' }, { nombre: 'asc' }],
        select: { id: true, nombre: true },
      }),
      this.prisma.usuario.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
    ]);

    return {
      clientes: clientes.map(({ id, razonSocial }) => ({ id, nombre: razonSocial })),
      servicios,
      usuarios,
      puedeCrear: usuario.permisos.has('proyecto:crear'),
    };
  }

  async indicadores(usuario: UsuarioAutenticado): Promise<IndicadoresProyectos> {
    const hoy = fechaHoyEnLima();
    const visibles = filtroProyectosVisibles(usuario);
    const abiertos: Prisma.ProyectoWhereInput = { estado: { in: ['PLANIFICADO', 'EN_CURSO', 'EN_PAUSA'] } };
    const [activos, finalizadosDelAnio, atrasados, conDificultades] = await Promise.all([
      this.prisma.proyecto.count({ where: { AND: [visibles, abiertos] } }),
      this.prisma.proyecto.count({
        where: { AND: [visibles, { estado: 'FINALIZADO', cerradoEn: { gte: aFechaDb(`${hoy.slice(0, 4)}-01-01`) } }] },
      }),
      this.prisma.proyecto.count({ where: { AND: [visibles, abiertos, { fechaEntrega: { lt: aFechaDb(hoy) } }] } }),
      this.prisma.proyecto.findMany({
        where: { AND: [visibles, abiertos, { conDificultades: true }] },
        include: INCLUSION_RESUMEN,
        orderBy: { fechaEntrega: 'asc' },
        take: 10,
      }),
    ]);

    return {
      activos,
      finalizadosDelAnio,
      atrasados,
      conDificultades: conDificultades.map((proyecto) => aResumen(proyecto, hoy)),
    };
  }
}
