import { Injectable } from '@nestjs/common';
import { type CodigoPermiso, esquemaCodigoPermiso, type RolReferencia } from '@sige/types';
import { PrismaService } from '../../prisma/prisma.service';

export const CODIGO_ROL_GERENCIA = 'GERENCIA';

export interface PermisosEfectivos {
  roles: RolReferencia[];
  permisos: ReadonlySet<CodigoPermiso>;
  alcanceGlobal: boolean;
  exigeMfa: boolean;
}

@Injectable()
export class PermisosEfectivosService {
  constructor(private readonly prisma: PrismaService) {}

  async resolver(usuarioId: string): Promise<PermisosEfectivos> {
    const asignaciones = await this.prisma.usuarioRol.findMany({
      where: { usuarioId, retiradoEn: null, rol: { activo: true } },
      orderBy: { asignadoEn: 'asc' },
      include: {
        rol: {
          include: {
            permisos: { where: { retiradoEn: null }, include: { permiso: true } },
          },
        },
      },
    });

    const permisos = new Set<CodigoPermiso>();

    for (const asignacion of asignaciones) {
      for (const otorgado of asignacion.rol.permisos) {
        const codigo = esquemaCodigoPermiso.safeParse(otorgado.permiso.codigo);

        if (codigo.success) {
          permisos.add(codigo.data);
        }
      }
    }

    return {
      roles: asignaciones.map(({ rol }) => ({ id: rol.id, codigo: rol.codigo, nombre: rol.nombre })),
      permisos,
      alcanceGlobal: asignaciones.some(({ rol }) => rol.alcance === 'GLOBAL'),
      exigeMfa: asignaciones.some(({ rol }) => rol.exigeMfa),
    };
  }
}
