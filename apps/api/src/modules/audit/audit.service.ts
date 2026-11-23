import { Injectable } from '@nestjs/common';
import type { AccionAuditoria, Prisma } from '@prisma/client';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';

export interface ActorAuditoria {
  usuarioId: string | null;
  sesionId: string | null;
  ip: string | null;
}

export interface EntradaAuditoria {
  actor: ActorAuditoria;
  accion: AccionAuditoria;
  entidad: string;
  entidadId: string | null;
  antes?: Prisma.InputJsonValue;
  despues?: Prisma.InputJsonValue;
  motivo?: string;
}

export type ClienteBaseDatos = PrismaService | Prisma.TransactionClient;

export function actorDesde(usuario: UsuarioAutenticado, cliente: ContextoCliente): ActorAuditoria {
  return { usuarioId: usuario.usuarioId, sesionId: usuario.sesionId, ip: cliente.ip };
}

export function actorAnonimo(cliente: ContextoCliente): ActorAuditoria {
  return { usuarioId: null, sesionId: null, ip: cliente.ip };
}

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(entrada: EntradaAuditoria, cliente: ClienteBaseDatos = this.prisma): Promise<void> {
    await cliente.auditoria.create({
      data: {
        usuarioId: entrada.actor.usuarioId,
        sesionId: entrada.actor.sesionId,
        ip: entrada.actor.ip,
        accion: entrada.accion,
        entidad: entrada.entidad,
        entidadId: entrada.entidadId,
        motivo: entrada.motivo ?? null,
        ...(entrada.antes === undefined ? {} : { antes: entrada.antes }),
        ...(entrada.despues === undefined ? {} : { despues: entrada.despues }),
      },
    });
  }
}
