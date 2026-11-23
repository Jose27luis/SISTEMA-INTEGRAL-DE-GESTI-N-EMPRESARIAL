import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  ClienteDetalle,
  ClienteResumen,
  FiltroClientes,
  PaginaClientes,
} from '@sige/types';
import type { UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaIso, aIso } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { AccesoClientesService } from './client-access.service';

export const CLIENTES_POR_PAGINA = 25;

const INCLUSION_RESUMEN = {
  regimenTributario: { select: { id: true, nombre: true } },
  responsable: { select: { id: true, nombre: true } },
  contactos: {
    where: { activo: true, principal: true },
    take: 1,
    select: { nombre: true },
  },
} satisfies Prisma.ClienteInclude;

type ClienteConResumen = Prisma.ClienteGetPayload<{ include: typeof INCLUSION_RESUMEN }>;

export interface UsuarioAsignable {
  id: string;
  nombre: string;
  correo: string;
}

function aResumen(cliente: ClienteConResumen): ClienteResumen {
  return {
    id: cliente.id,
    tipoPersona: cliente.tipoPersona,
    razonSocial: cliente.razonSocial,
    ruc: cliente.ruc,
    dni: cliente.dni,
    estado: cliente.estado,
    regimenTributario: cliente.regimenTributario,
    responsable: cliente.responsable,
    contactoPrincipal: cliente.contactos[0]?.nombre ?? null,
  };
}

function filtroBusqueda(filtro: FiltroClientes): Prisma.ClienteWhereInput {
  const condiciones: Prisma.ClienteWhereInput[] = [];

  if (filtro.busqueda !== undefined) {
    condiciones.push({
      OR: [
        { razonSocial: { contains: filtro.busqueda, mode: 'insensitive' } },
        { ruc: { startsWith: filtro.busqueda } },
        { dni: { startsWith: filtro.busqueda } },
      ],
    });
  }

  if (filtro.estado !== undefined) {
    condiciones.push({ estado: filtro.estado });
  }

  return { AND: condiciones };
}

@Injectable()
export class ConsultaClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoClientesService,
  ) {}

  async listar(filtro: FiltroClientes, usuario: UsuarioAutenticado): Promise<PaginaClientes> {
    const donde: Prisma.ClienteWhereInput = { AND: [this.acceso.filtroVisible(usuario), filtroBusqueda(filtro)] };

    const [total, clientes] = await this.prisma.$transaction([
      this.prisma.cliente.count({ where: donde }),
      this.prisma.cliente.findMany({
        where: donde,
        orderBy: [{ estado: 'asc' }, { razonSocial: 'asc' }],
        skip: (filtro.pagina - 1) * CLIENTES_POR_PAGINA,
        take: CLIENTES_POR_PAGINA,
        include: INCLUSION_RESUMEN,
      }),
    ]);

    return { total, pagina: filtro.pagina, porPagina: CLIENTES_POR_PAGINA, elementos: clientes.map(aResumen) };
  }

  async obtener(id: string, usuario: UsuarioAutenticado): Promise<ClienteDetalle> {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
      include: {
        ...INCLUSION_RESUMEN,
        contactos: { where: { activo: true }, orderBy: [{ principal: 'desc' }, { nombre: 'asc' }] },
        asignaciones: {
          where: { retiradoEn: null },
          orderBy: { asignadoEn: 'asc' },
          include: { usuario: { select: { id: true, nombre: true, correo: true } } },
        },
      },
    });

    if (cliente === null) {
      throw new NotFoundException({ mensaje: 'El cliente no existe.', errores: [] });
    }

    const principal = cliente.contactos.find((contacto) => contacto.principal);

    return {
      id: cliente.id,
      tipoPersona: cliente.tipoPersona,
      razonSocial: cliente.razonSocial,
      ruc: cliente.ruc,
      dni: cliente.dni,
      estado: cliente.estado,
      regimenTributario: cliente.regimenTributario,
      responsable: cliente.responsable,
      contactoPrincipal: principal?.nombre ?? null,
      domicilioFiscal: cliente.domicilioFiscal,
      representanteLegal: cliente.representanteLegal,
      actividadEconomica: cliente.actividadEconomica,
      fechaIncorporacion: aFechaIso(cliente.fechaIncorporacion),
      creadoEn: aIso(cliente.creadoEn),
      contactos: cliente.contactos.map((contacto) => ({
        id: contacto.id,
        nombre: contacto.nombre,
        cargo: contacto.cargo,
        correo: contacto.correo,
        telefono: contacto.telefono,
        principal: contacto.principal,
        activo: contacto.activo,
      })),
      asignaciones: cliente.asignaciones.map((asignacion) => ({
        id: asignacion.id,
        usuario: asignacion.usuario,
        rolEnCliente: asignacion.rolEnCliente,
        asignadoEn: aIso(asignacion.asignadoEn),
      })),
      puedeGestionar: usuario.permisos.has('cliente:gestionar'),
      puedeAsignar: usuario.permisos.has('cliente:asignar'),
    };
  }

  async historial(id: string): Promise<
    {
      id: string;
      fecha: string;
      usuario: string | null;
      accion: string;
      entidad: string;
      motivo: string | null;
      despues: Prisma.JsonValue;
    }[]
  > {
    const registros = await this.prisma.auditoria.findMany({
      where: { entidad: 'cliente', entidadId: id },
      orderBy: { id: 'desc' },
      take: 200,
      include: { usuario: { select: { nombre: true } } },
    });

    return registros.map((registro) => ({
      id: registro.id.toString(),
      fecha: aIso(registro.fecha),
      usuario: registro.usuario?.nombre ?? null,
      accion: registro.accion,
      entidad: registro.entidad,
      motivo: registro.motivo,
      despues: registro.despues,
    }));
  }

  async opciones(usuario: UsuarioAutenticado): Promise<{ id: string; nombre: string }[]> {
    const clientes = await this.prisma.cliente.findMany({
      where: { AND: [this.acceso.filtroVisible(usuario), { estado: { not: 'INACTIVO' } }] },
      orderBy: { razonSocial: 'asc' },
      select: { id: true, razonSocial: true },
    });

    return clientes.map(({ id, razonSocial }) => ({ id, nombre: razonSocial }));
  }

  usuariosAsignables(): Promise<UsuarioAsignable[]> {
    return this.prisma.usuario.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, correo: true },
    });
  }
}
