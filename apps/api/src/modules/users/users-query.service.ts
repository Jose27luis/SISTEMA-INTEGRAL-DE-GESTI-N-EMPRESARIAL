import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ESTADOS_CERRADOS, type UsuarioDetalle, type UsuarioResumen } from '@sige/types';
import { aIso, aIsoONulo } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { SesionesService } from '../auth/sessions.service';

const INCLUSION_ROLES = {
  roles: {
    where: { retiradoEn: null },
    orderBy: { asignadoEn: 'asc' },
    include: { rol: { select: { id: true, codigo: true, nombre: true } } },
  },
} satisfies Prisma.UsuarioInclude;

type UsuarioConRoles = Prisma.UsuarioGetPayload<{ include: typeof INCLUSION_ROLES }>;

function aResumen(usuario: UsuarioConRoles, ahora: Date): UsuarioResumen {
  const bloqueado =
    usuario.bloqueadoHasta !== null && usuario.bloqueadoHasta.getTime() > ahora.getTime();

  return {
    id: usuario.id,
    nombre: usuario.nombre,
    correo: usuario.correo,
    activo: usuario.activo,
    mfaActivo: usuario.mfaActivo,
    bloqueadoHasta: bloqueado ? aIsoONulo(usuario.bloqueadoHasta) : null,
    ultimoIngreso: aIsoONulo(usuario.ultimoIngreso),
    roles: usuario.roles.map(({ rol }) => rol),
  };
}

@Injectable()
export class ConsultaUsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sesiones: SesionesService,
  ) {}

  async listar(): Promise<UsuarioResumen[]> {
    const ahora = new Date();
    const usuarios = await this.prisma.usuario.findMany({
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      include: INCLUSION_ROLES,
    });

    return usuarios.map((usuario) => aResumen(usuario, ahora));
  }

  async obtener(id: string): Promise<UsuarioDetalle> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id }, include: INCLUSION_ROLES });

    if (usuario === null) {
      throw new NotFoundException({ mensaje: 'El usuario no existe.', errores: [] });
    }

    return {
      ...aResumen(usuario, new Date()),
      creadoEn: aIso(usuario.creadoEn),
      sesiones: await this.sesiones.listarVigentes(usuario.id, null),
      tareasAbiertas: await this.prisma.tarea.count({
        where: {
          estado: { notIn: [...ESTADOS_CERRADOS] },
          OR: [{ responsableId: usuario.id }, { revisorId: usuario.id }],
        },
      }),
    };
  }
}
