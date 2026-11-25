import { ETIQUETAS_TIPO_COMPROBANTE, esquemaFiltroEgresos, esquemaOpcionesFinanzas, esquemaPaginaEgresos } from '@sige/types';
import { Alerta, Campo, Insignia, Seleccion, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { FormularioConfirmacion } from '@/components/confirm-action-form';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { Paginacion } from '@/components/pagination';
import { solicitarApi } from '@/lib/api';
import { fechaHoyEnLima, formatearFecha, formatearMoneda } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { anularEgreso, crearEgreso } from '../actions';
import { FormularioEgreso } from '../finance-forms';

export const metadata: Metadata = { title: 'Egresos · TORRES ASOCIADOS' };

type ParametrosBusqueda = Record<string, string | string[] | undefined>;

const CAMPOS_FILTRO = ['desde', 'hasta', 'categoriaId', 'proveedorId', 'anulados'] as const;

function primerValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? '';
}

export default async function PaginaEgresos({ searchParams }: { searchParams: Promise<ParametrosBusqueda> }): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'finanza:egresos')) {
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
  const filtro = esquemaFiltroEgresos.safeParse(Object.fromEntries(consultaApi));
  const [egresos, opciones] = await Promise.all([
    filtro.success ? solicitarApi(`/finanzas/egresos?${consultaApi.toString()}`, { esquema: esquemaPaginaEgresos }) : Promise.resolve(null),
    solicitarApi('/finanzas/opciones', { esquema: esquemaOpcionesFinanzas }),
  ]);
  const puedeAnular = opciones.ok && opciones.datos.puedeAnular;

  return (
    <>
      <EncabezadoPagina titulo="Egresos" descripcion="Gastos administrativos del estudio. No se eliminan: se anulan con motivo." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Tarjeta>
            <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
              <Campo id="desde" name="desde" type="date" etiqueta="Desde" defaultValue={valores.desde} />
              <Campo id="hasta" name="hasta" type="date" etiqueta="Hasta" defaultValue={valores.hasta} />
              <Seleccion id="categoriaId-filtro" name="categoriaId" etiqueta="Categoría" defaultValue={valores.categoriaId}>
                <option value="">Todas</option>
                {opciones.ok
                  ? opciones.datos.categorias.map((categoria) => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.nombre}
                      </option>
                    ))
                  : null}
              </Seleccion>
              <Seleccion id="proveedorId-filtro" name="proveedorId" etiqueta="Proveedor" defaultValue={valores.proveedorId}>
                <option value="">Todos</option>
                {opciones.ok
                  ? opciones.datos.proveedores.map((proveedor) => (
                      <option key={proveedor.id} value={proveedor.id}>
                        {proveedor.razonSocial}
                      </option>
                    ))
                  : null}
              </Seleccion>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <label className="inline-flex min-h-11 items-center gap-2 text-sm text-tinta">
                  <input type="checkbox" name="anulados" value="si" defaultChecked={valores.anulados === 'si'} className="size-4" />
                  Incluir anulados
                </label>
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center rounded-md bg-marino px-5 text-sm font-semibold text-white hover:bg-marino-medio"
                >
                  Filtrar
                </button>
                <Link href="/finanzas/egresos" className="text-sm font-semibold text-marino-claro hover:underline">
                  Limpiar
                </Link>
              </div>
            </form>
          </Tarjeta>

          {egresos === null ? (
            <Alerta tono="error">Los filtros no son válidos. Revise las fechas.</Alerta>
          ) : egresos.ok ? (
            <Tarjeta
              titulo={`${String(egresos.datos.total)} ${egresos.datos.total === 1 ? 'egreso' : 'egresos'}`}
              descripcion={`Total vigente con estos filtros: ${formatearMoneda(egresos.datos.importeTotal)}`}
            >
              {egresos.datos.elementos.length === 0 ? (
                <p className="text-sm text-apagado">No hay egresos con estos filtros.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-borde">
                  {egresos.datos.elementos.map((egreso) => (
                    <li key={egreso.id} className="flex flex-col gap-2 py-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={egreso.anulado ? 'font-semibold text-apagado line-through' : 'font-semibold text-tinta'}>
                            {egreso.concepto}
                          </p>
                          <p className="text-xs text-apagado">
                            {formatearFecha(egreso.fecha)} · {egreso.categoria} · {egreso.medioPago}
                            {egreso.proveedor === null ? '' : ` · ${egreso.proveedor.razonSocial}`}
                            {egreso.cliente === null ? '' : ` · Cliente: ${egreso.cliente.razonSocial}`}
                            {egreso.proyecto === null ? '' : ` · Proyecto: ${egreso.proyecto.codigo}`}
                          </p>
                          <p className="text-xs text-apagado">
                            Responsable: {egreso.responsable.nombre}
                            {egreso.tipoComprobante === null
                              ? ''
                              : ` · ${ETIQUETAS_TIPO_COMPROBANTE[egreso.tipoComprobante]} ${egreso.serieNumero ?? ''}`}
                          </p>
                          {egreso.comprobante === null ? null : (
                            <a
                              href={`/archivos/${egreso.comprobante.id}`}
                              target="_blank"
                              rel="noopener"
                              className="text-xs font-semibold text-marino-claro hover:underline"
                            >
                              Comprobante: {egreso.comprobante.nombre}
                            </a>
                          )}
                          {egreso.observaciones === null ? null : (
                            <p className="mt-1 text-xs whitespace-pre-line text-tinta">{egreso.observaciones}</p>
                          )}
                          {egreso.anulado ? <p className="text-xs text-rojo">Anulado: {egreso.motivoAnulacion}</p> : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {egreso.anulado ? <Insignia tono="neutro">Anulado</Insignia> : null}
                          <span className="font-semibold whitespace-nowrap tabular-nums">{formatearMoneda(egreso.importe)}</span>
                        </div>
                      </div>
                      {!egreso.anulado && puedeAnular ? (
                        <details className="rounded-md border border-borde px-3 py-2">
                          <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-rojo">Anular egreso</summary>
                          <div className="pt-3">
                            <FormularioConfirmacion
                              accion={anularEgreso.bind(null, egreso.id)}
                              etiquetaBoton="Anular egreso"
                              textoPendiente="Anulando…"
                              variante="peligro"
                              pedirMotivo
                              consecuencia="Deja de contar en el flujo de caja y la rentabilidad. Queda en la auditoría."
                            />
                          </div>
                        </details>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              <Paginacion
                ruta="/finanzas/egresos"
                consulta={consulta}
                pagina={pagina}
                total={egresos.datos.total}
                porPagina={egresos.datos.porPagina}
              />
            </Tarjeta>
          ) : (
            <Alerta tono="error">{egresos.error.mensaje}</Alerta>
          )}
        </div>

        <Tarjeta titulo="Registrar egreso">
          {opciones.ok ? (
            opciones.datos.categorias.length === 0 || opciones.datos.mediosPago.length === 0 ? (
              <p className="text-sm text-apagado">Configure primero las categorías y los medios de pago.</p>
            ) : (
              <FormularioEgreso accion={crearEgreso} opciones={opciones.datos} hoy={fechaHoyEnLima()} usuarioId={perfil.usuario.id} />
            )
          ) : (
            <Alerta tono="error">{opciones.error.mensaje}</Alerta>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
