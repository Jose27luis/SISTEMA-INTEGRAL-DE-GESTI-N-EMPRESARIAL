import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  type CuentasPorCobrar,
  ETIQUETAS_TRAMO_ANTIGUEDAD,
  type FilaRentabilidad,
  type FiltroRangoMeses,
  type FlujoCaja,
  type HonorariosPorCliente,
  type IndicadoresFinancieros,
  MAXIMO_MESES_REPORTE,
  type Rentabilidad,
  TRAMOS_ANTIGUEDAD,
  type TramoAntiguedad,
} from '@sige/types';
import { aFechaDb, aFechaIso, aFechaIsoONula, fechaHoyEnLima } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import type { TablaExportable } from '../reports/report-exporter';
import {
  aCentimos,
  deCentimos,
  desplazarPeriodo,
  diasDeAtraso,
  mesesEntre,
  sumarMontos,
  tramoDeAntiguedad,
  ultimoDiaDelPeriodo,
} from './finance-rules';

interface Rango {
  desde: string;
  hasta: string;
  inicio: Date;
  fin: Date;
}

type Tramos = Record<TramoAntiguedad, number>;

function tramosVacios(): Tramos {
  return { POR_VENCER: 0, D0_30: 0, D31_60: 0, D61_90: 0, D90_MAS: 0 };
}

@Injectable()
export class ReportesFinancierosService {
  constructor(private readonly prisma: PrismaService) {}

  async nombreUsuario(usuarioId: string): Promise<string> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { nombre: true } });
    return usuario?.nombre ?? 'Usuario';
  }

  rango(filtro: FiltroRangoMeses): Rango {
    const actual = fechaHoyEnLima().slice(0, 7);
    const hasta = filtro.hasta ?? actual;
    const desde = filtro.desde ?? desplazarPeriodo(hasta, -11);

    if (mesesEntre(desde, hasta).length > MAXIMO_MESES_REPORTE) {
      throw new BadRequestException({
        mensaje: `El rango no puede superar ${String(MAXIMO_MESES_REPORTE)} meses.`,
        errores: [{ campo: 'desde', mensaje: 'Acorte el rango.' }],
      });
    }

    return { desde, hasta, inicio: aFechaDb(`${desde}-01`), fin: aFechaDb(ultimoDiaDelPeriodo(hasta)) };
  }

  async indicadores(): Promise<IndicadoresFinancieros> {
    const hoy = fechaHoyEnLima();
    const periodo = hoy.slice(0, 7);
    const inicio = aFechaDb(`${periodo}-01`);
    const fin = aFechaDb(ultimoDiaDelPeriodo(periodo));
    const [facturado, cobrado, pendiente, vencidos] = await Promise.all([
      this.prisma.ingreso.aggregate({ where: { anuladoEn: null, fechaEmision: { gte: inicio, lte: fin } }, _sum: { monto: true } }),
      this.prisma.cobro.aggregate({ where: { anuladoEn: null, fecha: { gte: inicio, lte: fin } }, _sum: { importe: true } }),
      this.prisma.ingreso.aggregate({ where: { anuladoEn: null, saldo: { gt: 0 } }, _sum: { saldo: true } }),
      this.prisma.ingreso.groupBy({
        by: ['clienteId'],
        where: { anuladoEn: null, saldo: { gt: 0 }, fechaVencimiento: { lt: aFechaDb(hoy) } },
        _sum: { saldo: true },
      }),
    ]);

    return {
      periodo,
      facturadoMes: Number(facturado._sum.monto ?? 0),
      cobradoMes: Number(cobrado._sum.importe ?? 0),
      porCobrar: Number(pendiente._sum.saldo ?? 0),
      vencido: sumarMontos(vencidos.map((fila) => Number(fila._sum.saldo ?? 0))),
      clientesMorosos: vencidos.length,
    };
  }

  async cuentasPorCobrar(): Promise<CuentasPorCobrar> {
    const hoy = fechaHoyEnLima();
    const ingresos = await this.prisma.ingreso.findMany({
      where: { anuladoEn: null, saldo: { gt: 0 } },
      select: {
        saldo: true,
        fechaVencimiento: true,
        cliente: { select: { id: true, razonSocial: true } },
      },
    });
    const porCliente = new Map<string, { cliente: { id: string; razonSocial: string }; tramos: Tramos; comprobantes: number; diasMaximo: number }>();
    const totales = tramosVacios();

    for (const ingreso of ingresos) {
      const saldo = aCentimos(Number(ingreso.saldo));
      const dias = diasDeAtraso(aFechaIso(ingreso.fechaVencimiento), hoy, Number(ingreso.saldo), false);
      const tramo = tramoDeAntiguedad(dias);
      const fila = porCliente.get(ingreso.cliente.id) ?? {
        cliente: ingreso.cliente,
        tramos: tramosVacios(),
        comprobantes: 0,
        diasMaximo: 0,
      };

      fila.tramos[tramo] += saldo;
      fila.comprobantes += 1;
      fila.diasMaximo = Math.max(fila.diasMaximo, dias);
      totales[tramo] += saldo;
      porCliente.set(ingreso.cliente.id, fila);
    }

    const aSoles = (tramos: Tramos): Tramos & { total: number } => {
      const convertidos = tramosVacios();
      let total = 0;

      for (const tramo of TRAMOS_ANTIGUEDAD) {
        convertidos[tramo] = deCentimos(tramos[tramo]);
        total += tramos[tramo];
      }

      return { ...convertidos, total: deCentimos(total) };
    };

    return {
      fecha: hoy,
      totales: aSoles(totales),
      clientes: [...porCliente.values()]
        .map((fila) => ({ cliente: fila.cliente, comprobantes: fila.comprobantes, diasMaximo: fila.diasMaximo, ...aSoles(fila.tramos) }))
        .sort((a, b) => b.diasMaximo - a.diasMaximo || b.total - a.total),
    };
  }

  async flujoCaja(filtro: FiltroRangoMeses): Promise<FlujoCaja> {
    const rango = this.rango(filtro);
    const [cobros, egresos] = await Promise.all([
      this.prisma.$queryRaw<{ periodo: string; importe: Prisma.Decimal }[]>`
        SELECT to_char(c.fecha, 'YYYY-MM') AS periodo, SUM(c.importe) AS importe
        FROM cobros c
        WHERE c.anulado_en IS NULL AND c.fecha BETWEEN ${rango.inicio} AND ${rango.fin}
        GROUP BY 1`,
      this.prisma.$queryRaw<{ periodo: string; categoria: string; importe: Prisma.Decimal }[]>`
        SELECT to_char(e.fecha, 'YYYY-MM') AS periodo, ce.nombre::text AS categoria, SUM(e.importe) AS importe
        FROM egresos e
        JOIN categorias_egreso ce ON ce.id = e.categoria_id
        WHERE e.anulado_en IS NULL AND e.fecha BETWEEN ${rango.inicio} AND ${rango.fin}
        GROUP BY 1, 2
        ORDER BY 3 DESC`,
    ]);
    const cobrosPorMes = new Map(cobros.map((fila) => [fila.periodo, Number(fila.importe)]));
    let acumulado = 0;
    const meses = mesesEntre(rango.desde, rango.hasta).map((periodo) => {
      const categorias = egresos.filter((fila) => fila.periodo === periodo);
      const cobrado = cobrosPorMes.get(periodo) ?? 0;
      const gastado = sumarMontos(categorias.map((fila) => Number(fila.importe)));
      const neto = deCentimos(aCentimos(cobrado) - aCentimos(gastado));
      acumulado = deCentimos(aCentimos(acumulado) + aCentimos(neto));

      return {
        periodo,
        cobros: cobrado,
        egresos: gastado,
        neto,
        acumulado,
        egresosPorCategoria: categorias.map((fila) => ({ categoria: fila.categoria, importe: Number(fila.importe) })),
      };
    });
    const totalCobros = sumarMontos(meses.map((mes) => mes.cobros));
    const totalEgresos = sumarMontos(meses.map((mes) => mes.egresos));

    return {
      desde: rango.desde,
      hasta: rango.hasta,
      meses,
      totales: { cobros: totalCobros, egresos: totalEgresos, neto: deCentimos(aCentimos(totalCobros) - aCentimos(totalEgresos)) },
    };
  }

  async rentabilidad(filtro: FiltroRangoMeses): Promise<Rentabilidad> {
    const rango = this.rango(filtro);
    const [facturado, cobrado, egresos, minutos] = await Promise.all([
      this.prisma.$queryRaw<{ cliente_id: string; razon_social: string; servicio_id: string | null; servicio: string | null; monto: Prisma.Decimal }[]>`
        SELECT i.cliente_id, cl.razon_social, s.id AS servicio_id, s.nombre::text AS servicio, SUM(i.monto) AS monto
        FROM ingresos i
        JOIN clientes cl ON cl.id = i.cliente_id
        LEFT JOIN servicios_contratados sc ON sc.id = i.servicio_contratado_id
        LEFT JOIN servicios s ON s.id = sc.servicio_id
        WHERE i.anulado_en IS NULL AND i.fecha_emision BETWEEN ${rango.inicio} AND ${rango.fin}
        GROUP BY 1, 2, 3, 4`,
      this.prisma.$queryRaw<{ cliente_id: string; importe: Prisma.Decimal }[]>`
        SELECT i.cliente_id, SUM(c.importe) AS importe
        FROM cobros c
        JOIN ingresos i ON i.id = c.ingreso_id
        WHERE c.anulado_en IS NULL AND c.fecha BETWEEN ${rango.inicio} AND ${rango.fin}
        GROUP BY 1`,
      this.prisma.$queryRaw<{ cliente_id: string; razon_social: string; importe: Prisma.Decimal }[]>`
        SELECT e.cliente_id, cl.razon_social, SUM(e.importe) AS importe
        FROM egresos e
        JOIN clientes cl ON cl.id = e.cliente_id
        WHERE e.anulado_en IS NULL AND e.cliente_id IS NOT NULL AND e.fecha BETWEEN ${rango.inicio} AND ${rango.fin}
        GROUP BY 1, 2`,
      this.prisma.$queryRaw<{ cliente_id: string; razon_social: string; minutos: bigint }[]>`
        SELECT t.cliente_id, cl.razon_social, SUM(a.minutos_dedicados)::bigint AS minutos
        FROM avances a
        JOIN tareas t ON t.id = a.tarea_id
        JOIN clientes cl ON cl.id = t.cliente_id
        WHERE t.cliente_id IS NOT NULL
          AND a.registrado_en >= ${rango.inicio}
          AND a.registrado_en < ${aFechaDb(`${desplazarPeriodo(rango.hasta, 1)}-01`)}
        GROUP BY 1, 2`,
    ]);
    const clientes = new Map<string, { nombre: string; facturado: number; cobrado: number; egresos: number; minutos: number }>();
    const cliente = (id: string, nombre: string): { nombre: string; facturado: number; cobrado: number; egresos: number; minutos: number } => {
      const existente = clientes.get(id);

      if (existente !== undefined) {
        return existente;
      }

      const nuevo = { nombre, facturado: 0, cobrado: 0, egresos: 0, minutos: 0 };
      clientes.set(id, nuevo);
      return nuevo;
    };

    for (const fila of facturado) {
      cliente(fila.cliente_id, fila.razon_social).facturado += aCentimos(Number(fila.monto));
    }

    for (const fila of egresos) {
      cliente(fila.cliente_id, fila.razon_social).egresos += aCentimos(Number(fila.importe));
    }

    for (const fila of minutos) {
      cliente(fila.cliente_id, fila.razon_social).minutos += Number(fila.minutos);
    }

    for (const fila of cobrado) {
      const existente = clientes.get(fila.cliente_id);

      if (existente !== undefined) {
        existente.cobrado += aCentimos(Number(fila.importe));
      }
    }

    const servicios = new Map<string, { nombre: string; facturado: number; cobrado: number; egresos: number; minutos: number }>();

    for (const fila of facturado) {
      const datosCliente = clientes.get(fila.cliente_id);
      const clave = fila.servicio_id ?? 'sin-servicio';
      const servicio = servicios.get(clave) ?? {
        nombre: fila.servicio ?? 'Sin servicio asignado',
        facturado: 0,
        cobrado: 0,
        egresos: 0,
        minutos: 0,
      };
      const monto = aCentimos(Number(fila.monto));
      const proporcion = datosCliente === undefined || datosCliente.facturado === 0 ? 0 : monto / datosCliente.facturado;

      servicio.facturado += monto;
      servicio.cobrado += Math.round((datosCliente?.cobrado ?? 0) * proporcion);
      servicio.egresos += Math.round((datosCliente?.egresos ?? 0) * proporcion);
      servicio.minutos += (datosCliente?.minutos ?? 0) * proporcion;
      servicios.set(clave, servicio);
    }

    const aFila = (id: string, datos: { nombre: string; facturado: number; cobrado: number; egresos: number; minutos: number }): FilaRentabilidad => {
      const horas = Math.round((datos.minutos / 60) * 10) / 10;

      return {
        id,
        nombre: datos.nombre,
        facturado: deCentimos(datos.facturado),
        cobrado: deCentimos(datos.cobrado),
        egresos: deCentimos(datos.egresos),
        horas,
        margen: deCentimos(datos.facturado - datos.egresos),
        ingresoPorHora: horas === 0 ? null : Math.round(deCentimos(datos.facturado) / horas * 100) / 100,
      };
    };

    return {
      desde: rango.desde,
      hasta: rango.hasta,
      porCliente: [...clientes.entries()].map(([id, datos]) => aFila(id, datos)).sort((a, b) => b.margen - a.margen),
      porServicio: [...servicios.entries()].map(([id, datos]) => aFila(id, datos)).sort((a, b) => b.margen - a.margen),
    };
  }

  async honorariosPorCliente(filtro: FiltroRangoMeses): Promise<HonorariosPorCliente> {
    const rango = this.rango(filtro);
    const hoy = aFechaDb(fechaHoyEnLima());
    const filas = await this.prisma.$queryRaw<
      {
        id: string;
        razon_social: string;
        honorario: Prisma.Decimal | null;
        facturado: Prisma.Decimal | null;
        cobrado: Prisma.Decimal | null;
        saldo: Prisma.Decimal | null;
        ultimo_pago: Date | null;
      }[]
    >`
      SELECT cl.id, cl.razon_social,
        (SELECT SUM(sc.honorario) FROM servicios_contratados sc
          WHERE sc.cliente_id = cl.id AND sc.activo AND sc.periodicidad = 'MENSUAL'
            AND sc.desde <= ${hoy} AND (sc.hasta IS NULL OR sc.hasta >= ${hoy})) AS honorario,
        (SELECT SUM(i.monto) FROM ingresos i
          WHERE i.cliente_id = cl.id AND i.anulado_en IS NULL AND i.fecha_emision BETWEEN ${rango.inicio} AND ${rango.fin}) AS facturado,
        (SELECT SUM(c.importe) FROM cobros c JOIN ingresos i ON i.id = c.ingreso_id
          WHERE i.cliente_id = cl.id AND c.anulado_en IS NULL AND c.fecha BETWEEN ${rango.inicio} AND ${rango.fin}) AS cobrado,
        (SELECT SUM(i.saldo) FROM ingresos i
          WHERE i.cliente_id = cl.id AND i.anulado_en IS NULL AND i.fecha_emision BETWEEN ${rango.inicio} AND ${rango.fin}) AS saldo,
        (SELECT MAX(c.fecha) FROM cobros c JOIN ingresos i ON i.id = c.ingreso_id
          WHERE i.cliente_id = cl.id AND c.anulado_en IS NULL) AS ultimo_pago
      FROM clientes cl
      WHERE (
          EXISTS (SELECT 1 FROM servicios_contratados sc WHERE sc.cliente_id = cl.id AND sc.activo)
          OR EXISTS (SELECT 1 FROM ingresos i WHERE i.cliente_id = cl.id AND i.anulado_en IS NULL AND i.fecha_emision BETWEEN ${rango.inicio} AND ${rango.fin})
        )
      ORDER BY cl.razon_social`;
    const convertidas = filas.map((fila) => ({
      cliente: { id: fila.id, razonSocial: fila.razon_social },
      honorarioMensual: Number(fila.honorario ?? 0),
      facturado: Number(fila.facturado ?? 0),
      cobrado: Number(fila.cobrado ?? 0),
      saldo: Number(fila.saldo ?? 0),
      ultimoPago: aFechaIsoONula(fila.ultimo_pago),
    }));

    return {
      desde: rango.desde,
      hasta: rango.hasta,
      filas: convertidas,
      totales: {
        honorarioMensual: sumarMontos(convertidas.map((fila) => fila.honorarioMensual)),
        facturado: sumarMontos(convertidas.map((fila) => fila.facturado)),
        cobrado: sumarMontos(convertidas.map((fila) => fila.cobrado)),
        saldo: sumarMontos(convertidas.map((fila) => fila.saldo)),
      },
    };
  }

  tablaCuentasPorCobrar(reporte: CuentasPorCobrar, usuario: string, generadoEn: string): TablaExportable {
    return {
      titulo: 'Cuentas por cobrar',
      filtros: [`Saldos al ${reporte.fecha}`, `${String(reporte.clientes.length)} clientes con saldo`],
      generadoPor: usuario,
      generadoEn,
      columnas: [
        { titulo: 'Cliente', ancho: 32 },
        ...TRAMOS_ANTIGUEDAD.map((tramo) => ({ titulo: ETIQUETAS_TRAMO_ANTIGUEDAD[tramo], ancho: 13, numerica: true })),
        { titulo: 'Total', ancho: 13, numerica: true },
      ],
      filas: reporte.clientes.map((fila) => [fila.cliente.razonSocial, ...TRAMOS_ANTIGUEDAD.map((tramo) => fila[tramo]), fila.total]),
      totales: ['Total', ...TRAMOS_ANTIGUEDAD.map((tramo) => reporte.totales[tramo]), reporte.totales.total],
    };
  }

  tablaFlujoCaja(reporte: FlujoCaja, usuario: string, generadoEn: string): TablaExportable {
    return {
      titulo: 'Flujo de caja administrativo',
      filtros: [`De ${reporte.desde} a ${reporte.hasta}`],
      generadoPor: usuario,
      generadoEn,
      columnas: [
        { titulo: 'Mes', ancho: 12 },
        { titulo: 'Cobros', ancho: 14, numerica: true },
        { titulo: 'Egresos', ancho: 14, numerica: true },
        { titulo: 'Neto', ancho: 14, numerica: true },
        { titulo: 'Acumulado', ancho: 14, numerica: true },
      ],
      filas: reporte.meses.map((mes) => [mes.periodo, mes.cobros, mes.egresos, mes.neto, mes.acumulado]),
      totales: ['Total', reporte.totales.cobros, reporte.totales.egresos, reporte.totales.neto, ''],
    };
  }

  tablaRentabilidad(reporte: Rentabilidad, usuario: string, generadoEn: string): TablaExportable {
    return {
      titulo: 'Rentabilidad por cliente',
      filtros: [`De ${reporte.desde} a ${reporte.hasta}`, 'Margen = facturado − egresos asignados al cliente'],
      generadoPor: usuario,
      generadoEn,
      columnas: [
        { titulo: 'Cliente', ancho: 30 },
        { titulo: 'Facturado', ancho: 13, numerica: true },
        { titulo: 'Cobrado', ancho: 13, numerica: true },
        { titulo: 'Egresos', ancho: 13, numerica: true },
        { titulo: 'Margen', ancho: 13, numerica: true },
        { titulo: 'Horas', ancho: 9, numerica: true },
        { titulo: 'S/ por hora', ancho: 11, numerica: true },
      ],
      filas: reporte.porCliente.map((fila) => [
        fila.nombre,
        fila.facturado,
        fila.cobrado,
        fila.egresos,
        fila.margen,
        fila.horas,
        fila.ingresoPorHora ?? '',
      ]),
      totales: [
        'Total',
        sumarMontos(reporte.porCliente.map((fila) => fila.facturado)),
        sumarMontos(reporte.porCliente.map((fila) => fila.cobrado)),
        sumarMontos(reporte.porCliente.map((fila) => fila.egresos)),
        sumarMontos(reporte.porCliente.map((fila) => fila.margen)),
        Math.round(reporte.porCliente.reduce((total, fila) => total + fila.horas, 0) * 10) / 10,
        '',
      ],
    };
  }

  tablaHonorarios(reporte: HonorariosPorCliente, usuario: string, generadoEn: string): TablaExportable {
    return {
      titulo: 'Honorarios y pagos por cliente',
      filtros: [`De ${reporte.desde} a ${reporte.hasta}`, `${String(reporte.filas.length)} clientes`],
      generadoPor: usuario,
      generadoEn,
      columnas: [
        { titulo: 'Cliente', ancho: 32 },
        { titulo: 'Honorario mensual', ancho: 15, numerica: true },
        { titulo: 'Facturado', ancho: 13, numerica: true },
        { titulo: 'Cobrado', ancho: 13, numerica: true },
        { titulo: 'Saldo', ancho: 13, numerica: true },
        { titulo: 'Último pago', ancho: 12 },
      ],
      filas: reporte.filas.map((fila) => [
        fila.cliente.razonSocial,
        fila.honorarioMensual,
        fila.facturado,
        fila.cobrado,
        fila.saldo,
        fila.ultimoPago ?? 'Sin pagos',
      ]),
      totales: [
        'Total',
        reporte.totales.honorarioMensual,
        reporte.totales.facturado,
        reporte.totales.cobrado,
        reporte.totales.saldo,
        '',
      ],
    };
  }
}
