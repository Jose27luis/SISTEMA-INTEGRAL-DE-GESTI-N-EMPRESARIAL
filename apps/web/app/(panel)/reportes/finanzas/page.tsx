import {
  esquemaCuentasPorCobrar,
  esquemaFiltroRangoMeses,
  esquemaFlujoCaja,
  esquemaHonorariosPorCliente,
  esquemaRentabilidad,
  ETIQUETAS_TRAMO_ANTIGUEDAD,
  type FilaRentabilidad,
  TRAMOS_ANTIGUEDAD,
} from '@sige/types';
import { Alerta, Campo, Tarjeta } from '@sige/ui/components';
import { cn } from '@sige/ui/cn';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Indicador } from '@/components/indicator-card';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { formatearFecha, formatearMoneda, formatearPeriodo } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';

export const metadata: Metadata = { title: 'Reportes financieros · TORRES ASOCIADOS' };

const VISTAS = [
  { clave: 'cobrar', etiqueta: 'Cuentas por cobrar', permiso: 'finanza:ingresos', tipo: 'cuentas-por-cobrar' },
  { clave: 'honorarios', etiqueta: 'Honorarios y pagos', permiso: 'finanza:ingresos', tipo: 'honorarios' },
  { clave: 'flujo', etiqueta: 'Flujo de caja', permiso: 'finanza:egresos', tipo: 'flujo-caja' },
  { clave: 'rentabilidad', etiqueta: 'Rentabilidad', permiso: 'finanza:egresos', tipo: 'rentabilidad' },
] as const;

type ParametrosBusqueda = Record<string, string | string[] | undefined>;

function primerValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? '';
}

const CLASE_ENLACE_DESCARGA =
  'inline-flex min-h-11 items-center rounded-md border border-borde bg-superficie px-4 text-sm font-semibold text-marino hover:border-marino-claro';

function Celda({ children, derecha = false, fuerte = false }: { children: ReactNode; derecha?: boolean; fuerte?: boolean }): ReactNode {
  return (
    <td className={cn('px-2 py-2 whitespace-nowrap', derecha && 'text-right tabular-nums', fuerte && 'font-semibold')}>{children}</td>
  );
}

function Encabezado({ children, derecha = false }: { children: ReactNode; derecha?: boolean }): ReactNode {
  return (
    <th scope="col" className={cn('px-2 py-2 font-semibold', derecha ? 'text-right' : 'text-left')}>
      {children}
    </th>
  );
}

function TablaRentabilidad({ filas, vacio }: { filas: FilaRentabilidad[]; vacio: string }): ReactNode {
  if (filas.length === 0) {
    return <p className="text-sm text-apagado">{vacio}</p>;
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-borde text-marino">
            <Encabezado>Nombre</Encabezado>
            <Encabezado derecha>Facturado</Encabezado>
            <Encabezado derecha>Cobrado</Encabezado>
            <Encabezado derecha>Egresos</Encabezado>
            <Encabezado derecha>Margen</Encabezado>
            <Encabezado derecha>Horas</Encabezado>
            <Encabezado derecha>S/ por hora</Encabezado>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.id} className="border-b border-borde last:border-0">
              <td className="py-2 pr-2 font-semibold text-tinta">{fila.nombre}</td>
              <Celda derecha>{formatearMoneda(fila.facturado)}</Celda>
              <Celda derecha>{formatearMoneda(fila.cobrado)}</Celda>
              <Celda derecha>{formatearMoneda(fila.egresos)}</Celda>
              <Celda derecha fuerte>
                <span className={fila.margen < 0 ? 'text-rojo' : 'text-tinta'}>{formatearMoneda(fila.margen)}</span>
              </Celda>
              <Celda derecha>{fila.horas.toFixed(1)}</Celda>
              <Celda derecha>{fila.ingresoPorHora === null ? 'Sin horas' : formatearMoneda(fila.ingresoPorHora)}</Celda>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function PaginaReportesFinancieros({ searchParams }: { searchParams: Promise<ParametrosBusqueda> }): Promise<ReactNode> {
  const perfil = await obtenerPerfil();
  const permitidas = VISTAS.filter(({ permiso }) => tienePermiso(perfil, permiso));

  if (permitidas.length === 0) {
    return <SinAcceso />;
  }

  const crudos = await searchParams;
  const vista = permitidas.find(({ clave }) => clave === primerValor(crudos.vista)) ?? permitidas[0];

  if (vista === undefined) {
    return <SinAcceso />;
  }

  const rango = esquemaFiltroRangoMeses.safeParse({ desde: primerValor(crudos.desde), hasta: primerValor(crudos.hasta) });
  const desde = rango.success ? (rango.data.desde ?? '') : '';
  const hasta = rango.success ? (rango.data.hasta ?? '') : '';
  const consultaRango = new URLSearchParams();

  if (desde !== '') {
    consultaRango.set('desde', desde);
  }

  if (hasta !== '') {
    consultaRango.set('hasta', hasta);
  }

  const sufijo = consultaRango.size === 0 ? '' : `?${consultaRango.toString()}`;
  const descarga = (formato: 'xlsx' | 'pdf'): string => {
    const consulta = new URLSearchParams(consultaRango);
    consulta.set('tipo', vista.tipo);
    consulta.set('formato', formato);
    return `/reportes/descarga?${consulta.toString()}`;
  };
  const enlaceVista = (clave: string): string => {
    const consulta = new URLSearchParams(consultaRango);
    consulta.set('vista', clave);
    return `/reportes/finanzas?${consulta.toString()}`;
  };

  let contenido: ReactNode;

  if (!rango.success) {
    contenido = <Alerta tono="error">El rango de meses no es válido.</Alerta>;
  } else if (vista.clave === 'cobrar') {
    const reporte = await solicitarApi('/reportes/cuentas-por-cobrar', { esquema: esquemaCuentasPorCobrar });
    contenido = !reporte.ok ? (
      <Alerta tono="error">{reporte.error.mensaje}</Alerta>
    ) : (
      <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Indicador etiqueta="Por cobrar" valor={formatearMoneda(reporte.datos.totales.total)} detalle={`Al ${formatearFecha(reporte.datos.fecha)}`} />
          <Indicador
            etiqueta="Vencido"
            valor={formatearMoneda(reporte.datos.totales.total - reporte.datos.totales.POR_VENCER)}
            tono={reporte.datos.totales.total - reporte.datos.totales.POR_VENCER > 0 ? 'alerta' : 'normal'}
            enlace="/finanzas/ingresos?vencidos=si"
          />
          <Indicador
            etiqueta="Más de 90 días"
            valor={formatearMoneda(reporte.datos.totales.D90_MAS)}
            tono={reporte.datos.totales.D90_MAS > 0 ? 'alerta' : 'normal'}
          />
        </div>
        <Tarjeta titulo={`${String(reporte.datos.clientes.length)} clientes con saldo`} descripcion="Antigüedad contada desde el vencimiento de cada comprobante.">
          {reporte.datos.clientes.length === 0 ? (
            <p className="text-sm text-apagado">No hay saldos pendientes.</p>
          ) : (
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[52rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-borde text-marino">
                    <Encabezado>Cliente</Encabezado>
                    {TRAMOS_ANTIGUEDAD.map((tramo) => (
                      <Encabezado key={tramo} derecha>
                        {ETIQUETAS_TRAMO_ANTIGUEDAD[tramo]}
                      </Encabezado>
                    ))}
                    <Encabezado derecha>Total</Encabezado>
                  </tr>
                </thead>
                <tbody>
                  {reporte.datos.clientes.map((fila) => (
                    <tr key={fila.cliente.id} className="border-b border-borde last:border-0">
                      <td className="py-2 pr-2">
                        <Link href={`/finanzas/ingresos?clienteId=${fila.cliente.id}`} className="font-semibold text-marino hover:underline">
                          {fila.cliente.razonSocial}
                        </Link>
                        <p className="text-xs text-apagado">
                          {fila.comprobantes} {fila.comprobantes === 1 ? 'pendiente' : 'pendientes'}
                          {fila.diasMaximo > 0 ? ` · hasta ${String(fila.diasMaximo)} días` : ''}
                        </p>
                      </td>
                      {TRAMOS_ANTIGUEDAD.map((tramo) => (
                        <Celda key={tramo} derecha>
                          <span className={fila[tramo] > 0 && tramo !== 'POR_VENCER' ? 'text-rojo' : 'text-tinta'}>
                            {fila[tramo] === 0 ? '—' : formatearMoneda(fila[tramo])}
                          </span>
                        </Celda>
                      ))}
                      <Celda derecha fuerte>
                        {formatearMoneda(fila.total)}
                      </Celda>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>
      </>
    );
  } else if (vista.clave === 'honorarios') {
    const reporte = await solicitarApi(`/reportes/honorarios${sufijo}`, { esquema: esquemaHonorariosPorCliente });
    contenido = !reporte.ok ? (
      <Alerta tono="error">{reporte.error.mensaje}</Alerta>
    ) : (
      <Tarjeta
        titulo={`Honorarios y pagos · ${formatearPeriodo(reporte.datos.desde)} a ${formatearPeriodo(reporte.datos.hasta)}`}
        descripcion="Facturado por fecha de emisión y cobrado por fecha de cobro dentro del rango."
      >
        {reporte.datos.filas.length === 0 ? (
          <p className="text-sm text-apagado">No hay clientes con servicios ni ingresos en el rango.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-borde text-marino">
                  <Encabezado>Cliente</Encabezado>
                  <Encabezado derecha>Honorario mensual</Encabezado>
                  <Encabezado derecha>Facturado</Encabezado>
                  <Encabezado derecha>Cobrado</Encabezado>
                  <Encabezado derecha>Saldo</Encabezado>
                  <Encabezado>Último pago</Encabezado>
                </tr>
              </thead>
              <tbody>
                {reporte.datos.filas.map((fila) => (
                  <tr key={fila.cliente.id} className="border-b border-borde last:border-0">
                    <td className="py-2 pr-2">
                      <Link href={`/clientes/${fila.cliente.id}/comercial`} className="font-semibold text-marino hover:underline">
                        {fila.cliente.razonSocial}
                      </Link>
                    </td>
                    <Celda derecha>{formatearMoneda(fila.honorarioMensual)}</Celda>
                    <Celda derecha>{formatearMoneda(fila.facturado)}</Celda>
                    <Celda derecha>{formatearMoneda(fila.cobrado)}</Celda>
                    <Celda derecha fuerte>
                      <span className={fila.saldo > 0 ? 'text-rojo' : 'text-tinta'}>{formatearMoneda(fila.saldo)}</span>
                    </Celda>
                    <Celda>{fila.ultimoPago === null ? 'Sin pagos' : formatearFecha(fila.ultimoPago)}</Celda>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-marino font-semibold">
                  <td className="py-2 pr-2">Total</td>
                  <Celda derecha>{formatearMoneda(reporte.datos.totales.honorarioMensual)}</Celda>
                  <Celda derecha>{formatearMoneda(reporte.datos.totales.facturado)}</Celda>
                  <Celda derecha>{formatearMoneda(reporte.datos.totales.cobrado)}</Celda>
                  <Celda derecha>{formatearMoneda(reporte.datos.totales.saldo)}</Celda>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Tarjeta>
    );
  } else if (vista.clave === 'flujo') {
    const reporte = await solicitarApi(`/reportes/flujo-caja${sufijo}`, { esquema: esquemaFlujoCaja });
    contenido = !reporte.ok ? (
      <Alerta tono="error">{reporte.error.mensaje}</Alerta>
    ) : (
      <>
        <div className="grid gap-4 sm:grid-cols-3">
          <Indicador etiqueta="Cobros" valor={formatearMoneda(reporte.datos.totales.cobros)} tono="exito" />
          <Indicador etiqueta="Egresos" valor={formatearMoneda(reporte.datos.totales.egresos)} />
          <Indicador
            etiqueta="Resultado"
            valor={formatearMoneda(reporte.datos.totales.neto)}
            tono={reporte.datos.totales.neto < 0 ? 'alerta' : 'exito'}
          />
        </div>
        <Tarjeta
          titulo={`Flujo de caja · ${formatearPeriodo(reporte.datos.desde)} a ${formatearPeriodo(reporte.datos.hasta)}`}
          descripcion="Cobros efectivamente recibidos frente a egresos pagados, por mes."
        >
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-borde text-marino">
                  <Encabezado>Mes</Encabezado>
                  <Encabezado derecha>Cobros</Encabezado>
                  <Encabezado derecha>Egresos</Encabezado>
                  <Encabezado derecha>Neto</Encabezado>
                  <Encabezado derecha>Acumulado</Encabezado>
                </tr>
              </thead>
              <tbody>
                {reporte.datos.meses.map((mes) => (
                  <tr key={mes.periodo} className="border-b border-borde align-top last:border-0">
                    <td className="py-2 pr-2">
                      <p className="font-semibold text-tinta">{formatearPeriodo(mes.periodo)}</p>
                      {mes.egresosPorCategoria.length === 0 ? null : (
                        <p className="text-xs text-apagado">
                          {mes.egresosPorCategoria.map(({ categoria, importe }) => `${categoria}: ${formatearMoneda(importe)}`).join(' · ')}
                        </p>
                      )}
                    </td>
                    <Celda derecha>{formatearMoneda(mes.cobros)}</Celda>
                    <Celda derecha>{formatearMoneda(mes.egresos)}</Celda>
                    <Celda derecha fuerte>
                      <span className={mes.neto < 0 ? 'text-rojo' : 'text-tinta'}>{formatearMoneda(mes.neto)}</span>
                    </Celda>
                    <Celda derecha>{formatearMoneda(mes.acumulado)}</Celda>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      </>
    );
  } else {
    const reporte = await solicitarApi(`/reportes/rentabilidad${sufijo}`, { esquema: esquemaRentabilidad });
    contenido = !reporte.ok ? (
      <Alerta tono="error">{reporte.error.mensaje}</Alerta>
    ) : (
      <>
        <Tarjeta
          titulo={`Por cliente · ${formatearPeriodo(reporte.datos.desde)} a ${formatearPeriodo(reporte.datos.hasta)}`}
          descripcion="Margen = facturado − egresos asignados al cliente. Horas: avances registrados en sus tareas."
        >
          <TablaRentabilidad filas={reporte.datos.porCliente} vacio="No hay ingresos, egresos ni horas en el rango." />
        </Tarjeta>
        <Tarjeta
          titulo="Por servicio"
          descripcion="Las horas y los egresos de cada cliente se reparten entre sus servicios según lo facturado por cada uno."
        >
          <TablaRentabilidad filas={reporte.datos.porServicio} vacio="No hay ingresos en el rango." />
        </Tarjeta>
      </>
    );
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Reportes financieros"
        descripcion="Cobranza, honorarios, flujo de caja y rentabilidad."
        acciones={
          <div className="flex gap-2">
            <a href={descarga('xlsx')} className={CLASE_ENLACE_DESCARGA}>
              Excel
            </a>
            <a
              href={descarga('pdf')}
              className="inline-flex min-h-11 items-center rounded-md bg-marino px-4 text-sm font-semibold text-white hover:bg-marino-medio"
            >
              PDF
            </a>
          </div>
        }
      />
      <nav aria-label="Reportes" className="mb-6 overflow-x-auto border-b border-borde">
        <ul className="flex min-w-max gap-1">
          {permitidas.map((opcion) => (
            <li key={opcion.clave}>
              <Link
                href={enlaceVista(opcion.clave)}
                aria-current={opcion.clave === vista.clave ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-semibold transition-colors',
                  opcion.clave === vista.clave
                    ? 'border-dorado text-marino'
                    : 'border-transparent text-apagado hover:border-borde hover:text-marino',
                )}
              >
                {opcion.etiqueta}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex flex-col gap-6">
        {vista.clave === 'cobrar' ? null : (
          <Tarjeta>
            <form method="get" className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="vista" value={vista.clave} />
              <div className="w-44">
                <Campo id="desde" name="desde" type="month" etiqueta="Desde" defaultValue={desde} />
              </div>
              <div className="w-44">
                <Campo id="hasta" name="hasta" type="month" etiqueta="Hasta" defaultValue={hasta} />
              </div>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-md bg-marino px-5 text-sm font-semibold text-white hover:bg-marino-medio"
              >
                Ver
              </button>
              <p className="text-sm text-apagado">Sin fechas: últimos 12 meses. Máximo 24 meses.</p>
            </form>
          </Tarjeta>
        )}
        {contenido}
      </div>
    </>
  );
}
