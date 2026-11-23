import { Injectable } from '@nestjs/common';
import type { TipoNotificacion } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ClienteBaseDatos } from '../audit/audit.service';

export const CANAL_NOTIFICACIONES = 'sige_notificaciones';

export interface AvisoNotificacion {
  destinatarios: readonly string[];
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  enlace: string;
  entidad: string;
  entidadId: string;
  claveDeduplicacion?: (usuarioId: string) => string;
}

@Injectable()
export class NotificacionesService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(aviso: AvisoNotificacion, actorId: string | null, db: ClienteBaseDatos = this.prisma): Promise<string[]> {
    const destinatarios = [...new Set(aviso.destinatarios)].filter((usuarioId) => usuarioId !== actorId);

    if (destinatarios.length === 0) {
      return [];
    }

    const creadas = await db.notificacion.createManyAndReturn({
      data: destinatarios.map((usuarioId) => ({
        usuarioId,
        tipo: aviso.tipo,
        titulo: aviso.titulo,
        mensaje: aviso.mensaje,
        enlace: aviso.enlace,
        entidad: aviso.entidad,
        entidadId: aviso.entidadId,
        claveDeduplicacion: aviso.claveDeduplicacion?.(usuarioId) ?? null,
      })),
      skipDuplicates: true,
      select: { usuarioId: true },
    });

    return creadas.map(({ usuarioId }) => usuarioId);
  }

  async publicar(usuarioIds: readonly string[]): Promise<void> {
    for (const usuarioId of new Set(usuarioIds)) {
      await this.prisma.$executeRaw`SELECT pg_notify(${CANAL_NOTIFICACIONES}, ${usuarioId})`;
    }
  }
}
