import { Injectable, NotFoundException } from '@nestjs/common';
import type { Notificacion as FilaNotificacion } from '@prisma/client';
import type { Notificacion, PaginaNotificaciones, ResumenNotificaciones } from '@sige/types';
import { aIso } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';

const POR_PAGINA = 30;
const RECIENTES = 8;

function aNotificacion(fila: FilaNotificacion): Notificacion {
  return {
    id: fila.id,
    tipo: fila.tipo,
    titulo: fila.titulo,
    mensaje: fila.mensaje,
    enlace: fila.enlace,
    leida: fila.leidaEn !== null,
    creadoEn: aIso(fila.creadoEn),
  };
}

@Injectable()
export class ConsultaNotificacionesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(usuarioId: string, pagina: number): Promise<PaginaNotificaciones> {
    const [total, noLeidas, filas] = await this.prisma.$transaction([
      this.prisma.notificacion.count({ where: { usuarioId } }),
      this.prisma.notificacion.count({ where: { usuarioId, leidaEn: null } }),
      this.prisma.notificacion.findMany({
        where: { usuarioId },
        orderBy: { creadoEn: 'desc' },
        skip: (pagina - 1) * POR_PAGINA,
        take: POR_PAGINA,
      }),
    ]);

    return { total, noLeidas, pagina, porPagina: POR_PAGINA, elementos: filas.map(aNotificacion) };
  }

  async resumen(usuarioId: string): Promise<ResumenNotificaciones> {
    const [noLeidas, filas] = await this.prisma.$transaction([
      this.prisma.notificacion.count({ where: { usuarioId, leidaEn: null } }),
      this.prisma.notificacion.findMany({ where: { usuarioId }, orderBy: { creadoEn: 'desc' }, take: RECIENTES }),
    ]);

    return { noLeidas, recientes: filas.map(aNotificacion) };
  }

  async marcarLeida(usuarioId: string, id: string): Promise<void> {
    const resultado = await this.prisma.notificacion.updateMany({
      where: { id, usuarioId, leidaEn: null },
      data: { leidaEn: new Date() },
    });

    if (resultado.count === 0) {
      const existe = await this.prisma.notificacion.count({ where: { id, usuarioId } });

      if (existe === 0) {
        throw new NotFoundException({ mensaje: 'La notificación no existe.', errores: [] });
      }
    }
  }

  async marcarTodas(usuarioId: string): Promise<void> {
    await this.prisma.notificacion.updateMany({
      where: { usuarioId, leidaEn: null },
      data: { leidaEn: new Date() },
    });
  }
}
