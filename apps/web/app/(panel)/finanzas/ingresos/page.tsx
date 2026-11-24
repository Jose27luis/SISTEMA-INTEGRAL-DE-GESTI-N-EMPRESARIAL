import {
  ESTADOS_COBRANZA,
  ETIQUETAS_ESTADO_COBRANZA,
  ETIQUETAS_TIPO_COMPROBANTE,
  esquemaFiltroIngresos,
  esquemaOpcionesFinanzas,
  esquemaPaginaIngresos,
} from '@sige/types';
import { Alerta, Campo, Seleccion, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { EstadoCobro } from '@/components/collection-status';
import { Indicador } from '@/components/indicator-card';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { Paginacion } from '@/components/pagination';
import { solicitarApi } from '@/lib/api';
import { fechaHoyEnLima, formatearFecha, formatearMoneda } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { generarHonorarios } from '../actions';
import { FormularioGenerarHonorarios } from '../finance-forms';

export const metadata: Metadata = { title: 'Ingresos y cobranza · TORRES ASOCIADOS' };

type ParametrosBusqueda = Record<string, string | string[] | undefined>;

const CAMPOS_FILTRO = ['busqueda', 'clienteId', 'estado', 'periodo', 'vencidos'] as const;

function primerValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? '';
}

export default async function PaginaIngresos({ searchParams }: { searchParams: Promise<ParametrosBusqueda> }): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'comercial:ver')) {
    return <SinAcceso />;
  }

  const crudos = await searchParams;
  const valores = Object.fromEntries(CAMPOS_FILTRO.map((campo) => [campo, primerValor(crudos[campo]).trim()])) as Record<
    (typeof CAMPOS_FILTRO)[number],
    string
  >;
  const pagina = Math.max(1, Number(primerValor(crudos.pagina)) || 1);
  const consulta = new URLSearchParams();

  for (const campo of CAMPOS_FILTRO) {
    if (valores[campo] !== '') {
      consulta.set(campo, valores[campo]);
    }
  }

  const consultaApi = new URLSearchParams(consulta);
  consultaApi.set('pagina', String(pagina));
  const filtro = esquemaFiltroIngresos.safeParse(Object.fromEntries(consultaApi));
  const [ingresos, opciones] = await Promise.all([
    filtro.success
      ? solicitarApi(`/finanzas/ingresos?${consultaApi.toString()}`, { esquema: esquemaPaginaIngresos })
      : Promise.resolve(null),
    solicitarApi('/finanzas/opciones', { esquema: esquemaOpcionesFinanzas }),
  ]);
  const puedeRegistrar = opciones.ok && opciones.datos.puedeIngresos;

  return (
    <>
      <EncabezadoPagina
        titulo="Ingresos y cobranza"
        descripcion="Honorarios y servicios facturados a los clientes, sus cobros y el saldo pendiente."
        acciones={
          puedeRegistrar ? (
            <Link
              href="/finanzas/ingresos/nuevo"
              className="inline-flex min-h-11 items-center rounded-md bg-marino px-4 text-sm font-semibold text-white hover:bg-marino-medio"
            >
              Registrar ingreso
            </Link>
          ) : null
        }
      />
      <div className="flex flex-col gap-6">
        {puedeRegistrar ? (
          <Tarjeta
            titulo="Honorarios mensuales"
            descripcion="Crea un ingreso por cada servicio mensual vigente de los clientes activos. Se ejecuta solo cada día; no duplica los ya generados."
          >
            <FormularioGenerarHonorarios accion={generarHonorarios} periodo={fechaHoyEnLima().slice(0, 7)} />
          </Tarjeta>
        ) : null}

        <Tarjeta>
          <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_1fr_1fr_auto] lg:items-end">
            <Campo id="busqueda" name="busqueda" etiqueta="Concepto o comprobante" defaultValue={valores.busqueda} maxLength={100} />
            <Seleccion id="clienteId" name="clienteId" etiqueta="Cliente" defaultValue={valores.clienteId}>
              <option value="">Todos</option>
              {opciones.ok
                ? opciones.datos.clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.razonSocial}
                    </option>
                  ))
                : null}
            </Seleccion>
            <Seleccion id="estado" name="estado" etiqueta="Estado" defaultValue={valores.estado}>
              <option value="">Todos</option>
              {ESTADOS_COBRANZA.map((estado) => (
                <option key={estado} value={estado}>
                  {ETIQUETAS_ESTADO_COBRANZA[estado]}
                </option>
              ))}
            </Seleccion>
            <Campo id="periodo" name="periodo" type="month" etiqueta="Periodo" defaultValue={valores.periodo} />
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-1">
              <label className="inline-flex min-h-11 items-center gap-2 text-sm text-tinta">
                <input type="checkbox" name="vencidos" value="si" defaultChecked={valores.vencidos === 'si'} className="size-4" />
                Solo vencidos
              </label>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-md bg-marino px-5 text-sm font-semibold text-white hover:bg-marino-medio"
              >
                Filtrar
              </button>
              <Link href="/finanzas/ingresos" className="text-sm font-semibold text-marino-claro hover:underline">
                Limpiar
              </Link>
            </div>
          </form>
        </Tarjeta>

        {ingresos === null ? (
          <Alerta tono="error">Los filtros no son válidos.</Alerta>
        ) : ingresos.ok ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Indicador etiqueta="Facturado" valor={formatearMoneda(ingresos.datos.totales.monto)} detalle="Con estos filtros, sin anulados" />
              <Indicador etiqueta="Cobrado" valor={formatearMoneda(ingresos.datos.totales.pagado)} />
              <Indicador
                etiqueta="Saldo pendiente"
                valor={formatearMoneda(ingresos.datos.totales.saldo)}
                tono={ingresos.datos.totales.saldo > 0 ? 'alerta' : 'normal'}
              />
            </div>
            <Tarjeta titulo={`${String(ingresos.datos.total)} ${ingresos.datos.total === 1 ? 'ingreso' : 'ingresos'}`}>
              {ingresos.datos.elementos.length === 0 ? (
                <p className="text-sm text-apagado">No hay ingresos con estos filtros.</p>
              ) : (
                <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                  <table className="w-full min-w-[52rem] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-borde text-left text-marino">
                        <th scope="col" className="py-2 pr-3 font-semibold">Cliente y concepto</th>
                        <th scope="col" className="px-2 py-2 font-semibold">Comprobante</th>
                        <th scope="col" className="px-2 py-2 font-semibold">Vence</th>
                        <th scope="col" className="px-2 py-2 text-right font-semibold">Monto</th>
                        <th scope="col" className="px-2 py-2 text-right font-semibold">Saldo</th>
                        <th scope="col" className="py-2 pl-2 font-semibold">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingresos.datos.elementos.map((ingreso) => (
                        <tr key={ingreso.id} className="border-b border-borde align-top last:border-0">
                          <td className="py-3 pr-3">
                            <Link href={`/finanzas/ingresos/${ingreso.id}`} className="font-semibold text-marino hover:underline">
                              {ingreso.cliente.razonSocial}
                            </Link>
                            <p className="text-apagado">{ingreso.concepto}</p>
                          </td>
                          <td className="px-2 py-3 text-tinta">
                            {ingreso.tipoComprobante === null
                              ? 'Pendiente'
                              : `${ETIQUETAS_TIPO_COMPROBANTE[ingreso.tipoComprobante]} ${ingreso.serieNumero ?? ''}`}
                          </td>
                          <td className="px-2 py-3 whitespace-nowrap text-tinta">{formatearFecha(ingreso.fechaVencimiento)}</td>
                          <td className="px-2 py-3 text-right whitespace-nowrap tabular-nums">{formatearMoneda(ingreso.monto)}</td>
                          <td className="px-2 py-3 text-right font-semibold whitespace-nowrap tabular-nums">
                            {formatearMoneda(ingreso.saldo)}
                          </td>
                          <td className="py-3 pl-2">
                            <EstadoCobro estado={ingreso.estado} diasVencido={ingreso.diasVencido} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Paginacion
                ruta="/finanzas/ingresos"
                consulta={consulta}
                pagina={pagina}
                total={ingresos.datos.total}
                porPagina={ingresos.datos.porPagina}
              />
            </Tarjeta>
          </>
        ) : (
          <Alerta tono="error">{ingresos.error.mensaje}</Alerta>
        )}
      </div>
    </>
  );
}
