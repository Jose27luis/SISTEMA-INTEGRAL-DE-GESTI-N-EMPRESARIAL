import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { esquemaCodigoPermiso, type Permiso, type RolResumen } from '@sige/types';
import { PrismaService } from '../../prisma/prisma.service';

const INCLUSION_ROL = {
  permisos: { where: { retiradoEn: null }, select: { permisoId: true } },
  _count: { select: { usuarios: { where: { retiradoEn: null, usuario: { activo: true } } } } },
} satisfies Prisma.RolInclude;

type RolConRelaciones = Prisma.RolGetPayload<{ include: typeof INCLUSION_ROL }>;

function aResumen(rol: RolConRelaciones): RolResumen {
  return {
    id: rol.id,
    codigo: rol.codigo,
    nombre: rol.nombre,
    descripcion: rol.descripcion,
    alcance: rol.alcance,
    exigeMfa: rol.exigeMfa,
    esSistema: rol.esSistema,
    activo: rol.activo,
    totalUsuarios: rol._count.usuarios,
    permisoIds: rol.permisos.map(({ permisoId }) => permisoId),
  };
}

@Injectable()
export class ConsultaRolesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(): Promise<RolResumen[]> {
    const roles = await this.prisma.rol.findMany({
      orderBy: [{ esSistema: 'desc' }, { nombre: 'asc' }],
      include: INCLUSION_ROL,
    });

    return roles.map(aResumen);
  }

  async obtener(id: string): Promise<RolResumen> {
    const rol = await this.prisma.rol.findUnique({ where: { id }, include: INCLUSION_ROL });

    if (rol === null) {
      throw new NotFoundException({ mensaje: 'El rol no existe.', errores: [] });
    }

    return aResumen(rol);
  }

  async listarPermisos(): Promise<Permiso[]> {
    const permisos = await this.prisma.permiso.findMany({ orderBy: [{ modulo: 'asc' }, { codigo: 'asc' }] });

    return permisos.flatMap((permiso) => {
      const codigo = esquemaCodigoPermiso.safeParse(permiso.codigo);

      return codigo.success ? [{ ...permiso, codigo: codigo.data }] : [];
    });
  }
}
