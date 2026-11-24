import { Injectable } from '@nestjs/common';
import type { ResultadoHonorarios } from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb, aFechaIso, aFechaIsoONula } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService, type ClienteBaseDatos } from '../audit/audit.service';
import { aplicaServicioEnPeriodo, fechaDelPeriodo, ultimoDiaDelPeriodo } from './finance-rules';

const NOMBRES_MES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'setiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export function nombrePeriodo(periodo: string): string {
  const [anio, mes] = periodo.split('-');
  return `${NOMBRES_MES[Number(mes) - 1] ?? mes ?? ''} ${anio ?? ''}`;
}

@Injectable()
export class GeneracionHonorariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async generarManual(periodo: string, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<ResultadoHonorarios> {
    return this.prisma.$transaction(async (tx) => {
      const resultado = await this.generar(tx, periodo);

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'CREAR',
          entidad: 'generacion_honorarios',
          entidadId: null,
          despues: { ...resultado },
        },
        tx,
      );

      return resultado;
    });
  }

  async generar(tx: ClienteBaseDatos, periodo: string): Promise<ResultadoHonorarios> {
    const inicio = aFechaDb(`${periodo}-01`);
    const fin = aFechaDb(ultimoDiaDelPeriodo(periodo));
    const servicios = await tx.servicioContratado.findMany({
      where: {
        activo: true,
        periodicidad: 'MENSUAL',
        desde: { lte: fin },
        OR: [{ hasta: null }, { hasta: { gte: inicio } }],
        cliente: { estado: 'ACTIVO' },
      },
      include: {
        servicio: { select: { nombre: true } },
        cliente: { select: { contrato: { select: { diaPago: true } } } },
        ingresos: { where: { periodo, generadoAutomaticamente: true }, select: { id: true } },
      },
    });
    let generados = 0;
    let existentes = 0;

    for (const servicio of servicios) {
      if (!aplicaServicioEnPeriodo(periodo, aFechaIso(servicio.desde), aFechaIsoONula(servicio.hasta))) {
        continue;
      }

      if (servicio.ingresos.length > 0) {
        existentes += 1;
        continue;
      }

      const diaPago = servicio.cliente.contrato?.diaPago ?? 28;
      const { count } = await tx.ingreso.createMany({
        data: [
          {
            clienteId: servicio.clienteId,
            servicioContratadoId: servicio.id,
            concepto: `${servicio.servicio.nombre} · ${nombrePeriodo(periodo)}`,
            periodo,
            fechaEmision: inicio,
            fechaVencimiento: aFechaDb(fechaDelPeriodo(periodo, diaPago)),
            monto: servicio.honorario,
            saldo: servicio.honorario,
            generadoAutomaticamente: true,
          },
        ],
        skipDuplicates: true,
      });

      if (count > 0) {
        generados += 1;
      } else {
        existentes += 1;
      }
    }

    return { periodo, generados, existentes };
  }
}
