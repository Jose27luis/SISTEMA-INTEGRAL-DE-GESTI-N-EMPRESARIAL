import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  type ControlMensual,
  ESTADOS_CERRADOS,
  ESTADOS_OBLIGACION,
  type EstadoObligacion,
  type EstadoTarea,
  type FiltroObligaciones,
  type HistorialTributario,
  type IndicadoresTributarios,
  type ListaObligaciones,
  type ObligacionDetalle,
  type ObligacionResumen,
  type OpcionesObligaciones,
} from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb, aFechaIso, aFechaIsoONula, aIso, fechaHoyEnLima, inicioDelDiaEnLima } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
import { AccesoClientesService } from '../clients/client-access.service';
import { aplicaEnPeriodo, desplazarPeriodo, estadoObligacion, estaVencida } from './obligation-rules';

const DIAS_POR_VENCER = 7;
const MAXIMO_PROXIMAS = 8;

const INCLUSION_RESUMEN = {
  tarea: { select: { estado: true } },
  obligacionCliente: {
    select: {
      tipoObligacion: { select: { id: true, codigo: true, nombre: true, usaCronograma: true } },
      cliente: { select: { id: true, razonSocial: true, ruc: true, grupoCronograma: true } },
      responsable: { select: { id: true, nombre: true } },
      revisor: { select: { id: true, nombre: true } },
    },
  },
} satisfies Prisma.ObligacionPeriodoInclude;

type ObligacionConRelaciones = Prisma.ObligacionPeriodoGetPayload<{ include: typeof INCLUSION_RESUMEN }>;

function ultimoDiaDelMes(mes: string): string {
  const [anio, numero] = mes.split('-').map(Number);
  return new Date(Date.UTC(anio ?? 2000, numero ?? 1, 0)).toISOString().slice(0, 10);
}

function sumarDias(fecha: string, dias: number): string {
  const resultado = aFechaDb(fecha);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return aFechaIso(resultado);
}

export function puedeRectificar(
  usuario: UsuarioAutenticado,
  ejecutores: readonly string[],
  presentada: boolean,
  estadoTarea: EstadoTarea,
): boolean {
  return (
    presentada &&
    (estadoTarea === 'APROBADA' || estadoTarea === 'FINALIZADA') &&
    (ejecutores.includes(usuario.usuarioId) || usuario.permisos.has('obligacion:gestionar'))
  );
}

export function aResumen(obligacion: ObligacionConRelaciones, hoy: string): ObligacionResumen {
  const estado = estadoObligacion(obligacion.tarea.estado, obligacion.fechaPresentacion !== null);
  const fechaVencimiento = aFechaIso(obligacion.fechaVencimiento);
  const { tipoObligacion, cliente, responsable, revisor } = obligacion.obligacionCliente;

  return {
    id: obligacion.id,
    periodo: obligacion.periodo,
    fechaVencimiento,
    estado,
    vencida: estaVencida(estado, fechaVencimiento, hoy),
    cliente: { id: cliente.id, razonSocial: cliente.razonSocial, ruc: cliente.ruc },
    tipoObligacion: { id: tipoObligacion.id, codigo: tipoObligacion.codigo, nombre: tipoObligacion.nombre },
    responsable,
    revisor,
    tareaId: obligacion.tareaId,
    fechaPresentacion: aFechaIsoONula(obligacion.fechaPresentacion),
  };
}

@Injectable()
export class ConsultaObligacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly accesoClientes: AccesoClientesService,
  ) {}

  filtroVisible(usuario: UsuarioAutenticado): Prisma.ObligacionClienteWhereInput {
    if (usuario.alcance === 'GLOBAL') {
      return {};
    }

    const propias: Prisma.ObligacionClienteWhereInput[] = [
      { responsableId: usuario.usuarioId },
      { revisorId: usuario.usuarioId },
    ];

    if (usuario.alcance === 'ASIGNADO') {
      propias.push({ cliente: { asignaciones: { some: { usuarioId: usuario.usuarioId, retiradoEn: null } } } });
    }

    return { OR: propias };
  }

  async listar(filtro: FiltroObligaciones, usuario: UsuarioAutenticado): Promise<ListaObligaciones> {
    const hoy = fechaHoyEnLima();
    const mes = filtro.mes ?? hoy.slice(0, 7);
    const obligaciones = await this.prisma.obligacionPeriodo.findMany({
      where: {
        fechaVencimiento: { gte: aFechaDb(`${mes}-01`), lte: aFechaDb(ultimoDiaDelMes(mes)) },
        obligacionCliente: {
          AND: [
            this.filtroVisible(usuario),
            {
              ...(filtro.clienteId === undefined ? {} : { clienteId: filtro.clienteId }),
              ...(filtro.responsableId === undefined ? {} : { responsableId: filtro.responsableId }),
              ...(filtro.tipoObligacionId === undefined ? {} : { tipoObligacionId: filtro.tipoObligacionId }),
            },
          ],
        },
      },
      include: INCLUSION_RESUMEN,
      orderBy: [{ fechaVencimiento: 'asc' }, { obligacionCliente: { cliente: { razonSocial: 'asc' } } }],
    });

    return {
      mes,
      obligaciones: obligaciones
        .map((obligacion) => aResumen(obligacion, hoy))
        .filter((obligacion) => filtro.estado === undefined || obligacion.estado === filtro.estado),
    };
  }

  async opciones(usuario: UsuarioAutenticado): Promise<OpcionesObligaciones> {
    const visibles = await this.prisma.obligacionCliente.findMany({
      where: { AND: [this.filtroVisible(usuario), { activo: true }] },
      select: {
        cliente: { select: { id: true, razonSocial: true } },
        responsable: { select: { id: true, nombre: true } },
      },
    });
    const clientes = new Map(visibles.map(({ cliente }) => [cliente.id, cliente]));
    const responsables = new Map(visibles.map(({ responsable }) => [responsable.id, responsable]));
    const tipos = await this.prisma.tipoObligacion.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, codigo: true, nombre: true, usaCronograma: true },
    });

    return {
      clientes: [...clientes.values()].sort((a, b) => a.razonSocial.localeCompare(b.razonSocial)),
      responsables: [...responsables.values()].sort((a, b) => a.nombre.localeCompare(b.nombre)),
      tipos,
    };
  }

  async control(periodo: string, usuario: UsuarioAutenticado): Promise<ControlMensual> {
    const hoy = fechaHoyEnLima();
    const configuradas = await this.prisma.obligacionCliente.findMany({
      where: {
        AND: [this.filtroVisible(usuario)],
        OR: [{ activo: true }, { periodos: { some: { periodo } } }],
      },
      select: {
        id: true,
        activo: true,
        desdePeriodo: true,
        hastaPeriodo: true,
        tipoObligacion: { select: { id: true, codigo: true, nombre: true, activo: true } },
        cliente: { select: { id: true, razonSocial: true, ruc: true, estado: true } },
        periodos: { where: { periodo }, include: INCLUSION_RESUMEN },
      },
    });

    const tipos = new Map<string, { id: string; codigo: string; nombre: string }>();
    const filas = new Map<string, ControlMensual['filas'][number]>();
    const totales = Object.fromEntries(ESTADOS_OBLIGACION.map((estado) => [estado, 0])) as Record<
      EstadoObligacion,
      number
    >;
    let vencidas = 0;
    let sinGenerar = 0;

    for (const configurada of configuradas) {
      const generada = configurada.periodos[0];
      const aplica =
        configurada.activo &&
        configurada.tipoObligacion.activo &&
        configurada.cliente.estado === 'ACTIVO' &&
        aplicaEnPeriodo(periodo, configurada.desdePeriodo, configurada.hastaPeriodo);

      if (generada === undefined && !aplica) {
        continue;
      }

      const { tipoObligacion, cliente } = configurada;
      tipos.set(tipoObligacion.id, { id: tipoObligacion.id, codigo: tipoObligacion.codigo, nombre: tipoObligacion.nombre });

      const fila = filas.get(cliente.id) ?? {
        cliente: { id: cliente.id, razonSocial: cliente.razonSocial, ruc: cliente.ruc },
        celdas: {},
        configuradas: [],
      };
      fila.configuradas.push(tipoObligacion.id);

      if (generada === undefined) {
        fila.celdas[tipoObligacion.id] = null;
        sinGenerar += 1;
      } else {
        const resumen = aResumen(generada, hoy);
        fila.celdas[tipoObligacion.id] = {
          obligacionId: resumen.id,
          estado: resumen.estado,
          vencida: resumen.vencida,
          fechaVencimiento: resumen.fechaVencimiento,
        };
        totales[resumen.estado] += 1;
        vencidas += resumen.vencida ? 1 : 0;
      }

      filas.set(cliente.id, fila);
    }

    return {
      periodo,
      tipos: [...tipos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre)),
      filas: [...filas.values()].sort((a, b) => a.cliente.razonSocial.localeCompare(b.cliente.razonSocial)),
      totales,
      vencidas,
      sinGenerar,
      puedeGenerar: usuario.permisos.has('obligacion:gestionar'),
    };
  }

  async obtenerVisible(id: string, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<ObligacionConRelaciones> {
    const obligacion = await this.prisma.obligacionPeriodo.findUnique({ where: { id }, include: INCLUSION_RESUMEN });

    if (obligacion === null) {
      throw new NotFoundException({ mensaje: 'La obligación no existe.', errores: [] });
    }

    const visible = await this.prisma.obligacionCliente.count({
      where: { AND: [{ id: obligacion.obligacionClienteId }, this.filtroVisible(usuario)] },
    });

    if (visible === 0) {
      await this.auditoria.registrar({
        actor: actorDesde(usuario, contexto),
        accion: 'PERMISO_DENEGADO',
        entidad: 'obligacion_periodo',
        entidadId: id,
        motivo: 'Obligación fuera del alcance del usuario',
      });

      throw new ForbiddenException({ mensaje: 'No tiene acceso a esta obligación.', errores: [] });
    }

    return obligacion;
  }

  async detalle(id: string, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<ObligacionDetalle> {
    const obligacion = await this.obtenerVisible(id, usuario, contexto);
    const hoy = fechaHoyEnLima();
    const [constancia, aprobacion, colaboradores, rectificaciones] = await Promise.all([
      obligacion.constanciaId === null
        ? null
        : this.prisma.archivo.findUnique({
            where: { id: obligacion.constanciaId },
            select: { id: true, nombreOriginal: true, tamanoBytes: true },
          }),
      this.prisma.rondaRevision.findFirst({
        where: { tareaId: obligacion.tareaId, decision: 'APROBADA' },
        orderBy: { numero: 'desc' },
        select: { fecha: true, revisor: { select: { nombre: true } } },
      }),
      this.prisma.tareaColaborador.findMany({
        where: { tareaId: obligacion.tareaId, retiradoEn: null },
        select: { usuarioId: true },
      }),
      this.prisma.rectificacion.findMany({
        where: { obligacionPeriodoId: id },
        orderBy: { registradoEn: 'desc' },
        include: {
          constancia: { select: { id: true, nombreOriginal: true, tamanoBytes: true } },
          registradoPor: { select: { nombre: true } },
        },
      }),
    ]);
    const resumen = aResumen(obligacion, hoy);
    const ejecutores = [obligacion.obligacionCliente.responsable.id, ...colaboradores.map(({ usuarioId }) => usuarioId)];

    return {
      ...resumen,
      grupoCronograma: obligacion.obligacionCliente.cliente.grupoCronograma,
      usaCronograma: obligacion.obligacionCliente.tipoObligacion.usaCronograma,
      numeroOrden: obligacion.numeroOrden,
      observaciones: obligacion.observaciones,
      constancia:
        constancia === null
          ? null
          : { id: constancia.id, nombre: constancia.nombreOriginal, tamanoBytes: constancia.tamanoBytes },
      estadoTarea: obligacion.tarea.estado,
      aprobacion: aprobacion === null ? null : { revisor: aprobacion.revisor.nombre, fecha: aIso(aprobacion.fecha) },
      generadaEn: aIso(obligacion.generadaEn),
      puedePresentar:
        ejecutores.includes(usuario.usuarioId) &&
        !ESTADOS_CERRADOS.includes(obligacion.tarea.estado) &&
        obligacion.tarea.estado !== 'EN_REVISION',
      rectificaciones: rectificaciones.map((rectificacion) => ({
        id: rectificacion.id,
        motivo: rectificacion.motivo,
        fechaPresentacion: aFechaIso(rectificacion.fechaPresentacion),
        numeroOrden: rectificacion.numeroOrden,
        constancia: {
          id: rectificacion.constancia.id,
          nombre: rectificacion.constancia.nombreOriginal,
          tamanoBytes: rectificacion.constancia.tamanoBytes,
        },
        registradoPor: rectificacion.registradoPor.nombre,
        registradoEn: aIso(rectificacion.registradoEn),
      })),
      puedeRectificar: puedeRectificar(usuario, ejecutores, obligacion.fechaPresentacion !== null, obligacion.tarea.estado),
    };
  }

  async historial(clienteId: string, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<HistorialTributario> {
    await this.accesoClientes.asegurarAcceso(usuario, clienteId, contexto);
    const hoy = fechaHoyEnLima();
    const obligaciones = await this.prisma.obligacionPeriodo.findMany({
      where: { obligacionCliente: { AND: [{ clienteId }, this.filtroVisible(usuario)] } },
      include: {
        ...INCLUSION_RESUMEN,
        constancia: { select: { id: true, nombreOriginal: true } },
        rectificaciones: {
          orderBy: { registradoEn: 'asc' },
          include: { constancia: { select: { id: true, nombreOriginal: true } } },
        },
      },
      orderBy: [{ periodo: 'desc' }, { obligacionCliente: { tipoObligacion: { nombre: 'asc' } } }],
    });

    return {
      clienteId,
      periodos: obligaciones.map((obligacion) => ({
        ...aResumen(obligacion, hoy),
        numeroOrden: obligacion.numeroOrden,
        observaciones: obligacion.observaciones,
        constancia:
          obligacion.constancia === null
            ? null
            : { id: obligacion.constancia.id, nombre: obligacion.constancia.nombreOriginal },
        rectificaciones: obligacion.rectificaciones.map((rectificacion) => ({
          id: rectificacion.id,
          motivo: rectificacion.motivo,
          fechaPresentacion: aFechaIso(rectificacion.fechaPresentacion),
          numeroOrden: rectificacion.numeroOrden,
          constancia: { id: rectificacion.constancia.id, nombre: rectificacion.constancia.nombreOriginal },
        })),
      })),
    };
  }

  async indicadores(usuario: UsuarioAutenticado): Promise<IndicadoresTributarios> {
    const hoy = fechaHoyEnLima();
    const mes = hoy.slice(0, 7);
    const limite = sumarDias(hoy, DIAS_POR_VENCER);
    const visibles = this.filtroVisible(usuario);
    const sinPresentar: Prisma.ObligacionPeriodoWhereInput = {
      fechaPresentacion: null,
      tarea: { estado: { notIn: [...ESTADOS_CERRADOS] } },
      obligacionCliente: visibles,
    };
    const inicioMes = inicioDelDiaEnLima(`${mes}-01`);
    const inicioMesSiguiente = inicioDelDiaEnLima(`${desplazarPeriodo(mes, 1)}-01`);

    const [porVencer, vencidas, presentadasDelMes, cumplidasDelMes, proximas] = await Promise.all([
      this.prisma.obligacionPeriodo.count({
        where: { ...sinPresentar, fechaVencimiento: { gte: aFechaDb(hoy), lte: aFechaDb(limite) } },
      }),
      this.prisma.obligacionPeriodo.count({ where: { ...sinPresentar, fechaVencimiento: { lt: aFechaDb(hoy) } } }),
      this.prisma.obligacionPeriodo.count({
        where: {
          obligacionCliente: visibles,
          fechaPresentacion: { gte: aFechaDb(`${mes}-01`), lte: aFechaDb(ultimoDiaDelMes(mes)) },
        },
      }),
      this.prisma.obligacionPeriodo.count({
        where: {
          obligacionCliente: visibles,
          tarea: { estado: { in: ['APROBADA', 'FINALIZADA'] }, completadaEn: { gte: inicioMes, lt: inicioMesSiguiente } },
        },
      }),
      this.prisma.obligacionPeriodo.findMany({
        where: { ...sinPresentar, fechaVencimiento: { lte: aFechaDb(limite) } },
        include: INCLUSION_RESUMEN,
        orderBy: { fechaVencimiento: 'asc' },
        take: MAXIMO_PROXIMAS,
      }),
    ]);

    return {
      porVencer,
      vencidas,
      presentadasDelMes,
      cumplidasDelMes,
      proximas: proximas.map((obligacion) => aResumen(obligacion, hoy)),
    };
  }
}
