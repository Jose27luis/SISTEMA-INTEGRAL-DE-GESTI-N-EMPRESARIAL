import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';

@Injectable()
export class AccesoClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  filtroVisible(usuario: UsuarioAutenticado): Prisma.ClienteWhereInput {
    return usuario.alcanceGlobal
      ? {}
      : { asignaciones: { some: { usuarioId: usuario.usuarioId, retiradoEn: null } } };
  }

  async asegurarAcceso(usuario: UsuarioAutenticado, clienteId: string, contexto: ContextoCliente): Promise<void> {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: clienteId },
      select: {
        id: true,
        asignaciones: { where: { usuarioId: usuario.usuarioId, retiradoEn: null }, select: { id: true } },
      },
    });

    if (cliente === null) {
      throw new NotFoundException({ mensaje: 'El cliente no existe.', errores: [] });
    }

    if (usuario.alcanceGlobal || cliente.asignaciones.length > 0) {
      return;
    }

    await this.auditoria.registrar({
      actor: actorDesde(usuario, contexto),
      accion: 'PERMISO_DENEGADO',
      entidad: 'cliente',
      entidadId: clienteId,
      motivo: 'Cliente no asignado al usuario',
    });

    throw new ForbiddenException({ mensaje: 'No tiene asignado este cliente.', errores: [] });
  }
}
