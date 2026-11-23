import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Usuario } from '@prisma/client';
import type { PendienteIngreso, Perfil } from '@sige/types';
import type { UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aIsoONulo } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import {
  type PermisosEfectivos,
  PermisosEfectivosService,
} from '../access-control/effective-permissions.service';
import { calcularPendientes } from './pending-steps';

export interface AccesoUsuario extends PermisosEfectivos {
  pendientes: PendienteIngreso[];
}

@Injectable()
export class PerfilAccesoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permisosEfectivos: PermisosEfectivosService,
  ) {}

  async resolverAcceso(usuario: Usuario): Promise<AccesoUsuario> {
    const efectivos = await this.permisosEfectivos.resolver(usuario.id);

    return { ...efectivos, pendientes: calcularPendientes(usuario, efectivos.exigeMfa) };
  }

  async obtenerPerfil(autenticado: UsuarioAutenticado): Promise<Perfil> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: autenticado.usuarioId } });

    if (usuario === null) {
      throw new UnauthorizedException({ mensaje: 'Inicie sesión para continuar.', errores: [] });
    }

    const acceso = await this.resolverAcceso(usuario);

    return {
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        mfaActivo: usuario.mfaActivo,
        ultimoIngreso: aIsoONulo(usuario.ultimoIngreso),
      },
      roles: acceso.roles,
      permisos: [...acceso.permisos],
      alcanceGlobal: acceso.alcanceGlobal,
      exigeMfa: acceso.exigeMfa,
      pendientes: acceso.pendientes,
    };
  }
}
