import { Injectable } from '@nestjs/common';
import type { Ejecucion, FiltroEjecuciones, ListaEjecuciones } from '@sige/types';
import { aIso, aIsoONulo } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';

const MAXIMO_EJECUCIONES = 200;
const MS_DIA = 86_400_000;

interface FilaEjecucion {
  id: string;
  proceso: string;
  inicio: Date;
  fin: Date | null;
  resultado: Ejecucion['resultado'];
  registros: number;
  error: string | null;
}

function aEjecucion(fila: FilaEjecucion): Ejecucion {
  return {
    id: fila.id,
    proceso: fila.proceso,
    inicio: aIso(fila.inicio),
    fin: aIsoONulo(fila.fin),
    resultado: fila.resultado,
    registros: fila.registros,
    error: fila.error,
  };
}

@Injectable()
export class ProcesosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtro: FiltroEjecuciones): Promise<ListaEjecuciones> {
    const desde24h = new Date(Date.now() - MS_DIA);
    const [ultimas, errores, ejecuciones] = await Promise.all([
      this.prisma.ejecucionProceso.findMany({ distinct: ['proceso'], orderBy: [{ proceso: 'asc' }, { inicio: 'desc' }] }),
      this.prisma.ejecucionProceso.groupBy({
        by: ['proceso'],
        where: { resultado: 'ERROR', inicio: { gte: desde24h } },
        _count: { _all: true },
      }),
      this.prisma.ejecucionProceso.findMany({
        where: {
          ...(filtro.proceso === undefined ? {} : { proceso: filtro.proceso }),
          ...(filtro.resultado === undefined ? {} : { resultado: filtro.resultado }),
        },
        orderBy: { inicio: 'desc' },
        take: MAXIMO_EJECUCIONES,
      }),
    ]);
    const erroresPorProceso = new Map(errores.map((fila) => [fila.proceso, fila._count._all]));

    return {
      procesos: ultimas.map((ultima) => ({
        proceso: ultima.proceso,
        ultima: aEjecucion(ultima),
        errores24h: erroresPorProceso.get(ultima.proceso) ?? 0,
      })),
      ejecuciones: ejecuciones.map(aEjecucion),
    };
  }
}
