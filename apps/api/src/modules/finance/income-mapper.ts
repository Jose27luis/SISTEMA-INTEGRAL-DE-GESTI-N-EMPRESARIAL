import type { Prisma } from '@prisma/client';
import type { IngresoResumen } from '@sige/types';
import { aFechaIso } from '../../common/dates';
import { diasDeAtraso, estadoCobranza } from './finance-rules';

export const INCLUSION_INGRESO = {
  cliente: { select: { id: true, razonSocial: true } },
} satisfies Prisma.IngresoInclude;

export type IngresoConCliente = Prisma.IngresoGetPayload<{ include: typeof INCLUSION_INGRESO }>;

export function aResumenIngreso(ingreso: IngresoConCliente, hoy: string): IngresoResumen {
  const monto = Number(ingreso.monto);
  const pagado = Number(ingreso.montoPagado);
  const saldo = Number(ingreso.saldo);
  const anulado = ingreso.anuladoEn !== null;
  const fechaVencimiento = aFechaIso(ingreso.fechaVencimiento);
  const diasVencido = diasDeAtraso(fechaVencimiento, hoy, saldo, anulado);

  return {
    id: ingreso.id,
    cliente: ingreso.cliente,
    concepto: ingreso.concepto,
    periodo: ingreso.periodo,
    tipoComprobante: ingreso.tipoComprobante,
    serieNumero: ingreso.serieNumero,
    fechaEmision: aFechaIso(ingreso.fechaEmision),
    fechaVencimiento,
    monto,
    pagado,
    saldo,
    estado: estadoCobranza(monto, pagado, anulado),
    vencido: diasVencido > 0,
    diasVencido,
    generadoAutomaticamente: ingreso.generadoAutomaticamente,
  };
}
