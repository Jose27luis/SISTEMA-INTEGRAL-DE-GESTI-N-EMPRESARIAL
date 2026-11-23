import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { FiltroAuditoria } from '@sige/types';
import { aIso, finDelDiaEnLima, inicioDelDiaEnLima } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';

export const REGISTROS_POR_PAGINA = 50;

export interface RegistroAuditoriaRespuesta {
  id: string;
  fecha: string;
  usuario: { id: string; nombre: string } | null;
  ip: string | null;
  accion: string;
  entidad: string;
  entidadId: string | null;
  antes: Prisma.JsonValue;
  despues: Prisma.JsonValue;
  motivo: string | null;
}

export interface PaginaAuditoriaRespuesta {
  elementos: RegistroAuditoriaRespuesta[];
  total: number;
  pagina: number;
  porPagina: number;
}

function construirFiltro(filtro: FiltroAuditoria): Prisma.AuditoriaWhereInput {
  const fecha: Prisma.DateTimeFilter = {
    ...(filtro.desde === undefined ? {} : { gte: inicioDelDiaEnLima(filtro.desde) }),
    ...(filtro.hasta === undefined ? {} : { lte: finDelDiaEnLima(filtro.hasta) }),
  };

  return {
    ...(filtro.usuarioId === undefined ? {} : { usuarioId: filtro.usuarioId }),
    ...(filtro.entidad === undefined ? {} : { entidad: { equals: filtro.entidad, mode: 'insensitive' } }),
    ...(filtro.accion === undefined ? {} : { accion: filtro.accion }),
    ...(filtro.desde === undefined && filtro.hasta === undefined ? {} : { fecha }),
  };
}

@Injectable()
export class ConsultaAuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtro: FiltroAuditoria): Promise<PaginaAuditoriaRespuesta> {
    const donde = construirFiltro(filtro);

    const [total, registros] = await this.prisma.$transaction([
      this.prisma.auditoria.count({ where: donde }),
      this.prisma.auditoria.findMany({
        where: donde,
        orderBy: { id: 'desc' },
        skip: (filtro.pagina - 1) * REGISTROS_POR_PAGINA,
        take: REGISTROS_POR_PAGINA,
        include: { usuario: { select: { id: true, nombre: true } } },
      }),
    ]);

    return {
      total,
      pagina: filtro.pagina,
      porPagina: REGISTROS_POR_PAGINA,
      elementos: registros.map((registro) => ({
        id: registro.id.toString(),
        fecha: aIso(registro.fecha),
        usuario: registro.usuario,
        ip: registro.ip,
        accion: registro.accion,
        entidad: registro.entidad,
        entidadId: registro.entidadId,
        antes: registro.antes,
        despues: registro.despues,
        motivo: registro.motivo,
      })),
    };
  }
}
