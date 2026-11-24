import { ETIQUETAS_TIPO_COMPROBANTE, esquemaIngresoDetalle, esquemaOpcionesFinanzas } from '@sige/types';
import { Alerta, Insignia, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { EstadoCobro } from '@/components/collection-status';
import { FormularioConfirmacion } from '@/components/confirm-action-form';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { fechaHoyEnLima, formatearFecha, formatearFechaHora, formatearMoneda, formatearPeriodo } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { anularCobro, anularIngreso, registrarCobro, registrarComprobante } from '../../actions';
import { FormularioCobro, FormularioComprobante } from '../../finance-forms';

export const metadata: Metadata = { title: 'Ingreso · TORRES ASOCIADOS' };

export default async function PaginaIngreso({ params }: { params: Promise<{ id: string }> }): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'comercial:ver')) {
    return <SinAcceso />;
  }

  const { id } = await params;
  const [resultado, opciones] = await Promise.all([
    solicitarApi(`/finanzas/ingresos/${id}`, { esquema: esquemaIngresoDetalle }),
    solicitarApi('/finanzas/opciones', { esquema: esquemaOpcionesFinanzas }),
  ]);

  if (!resultado.ok) {
    return <Alerta tono="error">{resultado.error.mensaje}</Alerta>;
  }

  const ingreso = resultado.datos;
  const anulado = ingreso.anuladoEn !== null;
  const puedeRegistrar = opciones.ok && opciones.datos.puedeIngresos && !anulado;

  return (
    <>
      <EncabezadoPagina
        antetitulo="Ingresos y cobranza"
        titulo={ingreso.concepto}
        descripcion={`${ingreso.cliente.razonSocial}${ingreso.periodo === null ? '' : ` · ${formatearPeriodo(ingreso.periodo)}`}`}
        acciones={
          <Link
            href={`/clientes/${ingreso.cliente.id}/comercial`}
            className="inline-flex min-h-11 items-center rounded-md border border-borde bg-superficie px-4 text-sm font-semibold text-marino hover:border-marino-claro"
          >
            Ficha comercial
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          {anulado ? (
            <Alerta tono="aviso" titulo="Ingreso anulado">
              {formatearFechaHora(ingreso.anuladoEn)} · {ingreso.motivoAnulacion}
            </Alerta>
          ) : null}
          <Tarjeta titulo="Resumen">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-apagado">Estado</dt>
              <dd>
                <EstadoCobro estado={ingreso.estado} diasVencido={ingreso.diasVencido} />
              </dd>
              <dt className="text-apagado">Monto</dt>
              <dd className="font-semibold tabular-nums">{formatearMoneda(ingreso.monto)}</dd>
              <dt className="text-apagado">Cobrado</dt>
              <dd className="tabular-nums">{formatearMoneda(ingreso.pagado)}</dd>
              <dt className="text-apagado">Saldo</dt>
              <dd className="font-semibold tabular-nums text-marino">{formatearMoneda(ingreso.saldo)}</dd>
              <dt className="text-apagado">Emisión</dt>
              <dd>{formatearFecha(ingreso.fechaEmision)}</dd>
              <dt className="text-apagado">Vencimiento</dt>
              <dd>{formatearFecha(ingreso.fechaVencimiento)}</dd>
              <dt className="text-apagado">Comprobante</dt>
              <dd>
                {ingreso.tipoComprobante === null
                  ? 'Pendiente de registrar'
                  : `${ETIQUETAS_TIPO_COMPROBANTE[ingreso.tipoComprobante]} ${ingreso.serieNumero ?? ''}`}
              </dd>
              <dt className="text-apagado">Servicio</dt>
              <dd>{ingreso.servicio ?? 'Sin servicio asociado'}</dd>
              <dt className="text-apagado">Registrado</dt>
              <dd>
                {ingreso.creadoPor} · {formatearFechaHora(ingreso.creadoEn)}
                {ingreso.generadoAutomaticamente ? (
                  <span className="ml-2">
                    <Insignia tono="info">Automático</Insignia>
                  </span>
                ) : null}
              </dd>
            </dl>
          </Tarjeta>

          <Tarjeta titulo="Cobros">
            {ingreso.cobros.length === 0 ? (
              <p className="text-sm text-apagado">Todavía no hay cobros registrados.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-borde">
                {ingreso.cobros.map((cobro) => (
                  <li key={cobro.id} className="flex flex-col gap-2 py-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className={cobro.anulado ? 'font-semibold text-apagado line-through' : 'font-semibold text-tinta'}>
                          {formatearMoneda(cobro.importe)} · {cobro.medioPago}
                          {cobro.operacion === null ? '' : ` · Op. ${cobro.operacion}`}
                        </p>
                        <p className="text-xs text-apagado">
                          {formatearFecha(cobro.fecha)} · registró {cobro.registradoPor} el {formatearFechaHora(cobro.registradoEn)}
                        </p>
                        {cobro.voucher === null ? null : (
                          <a
                            href={`/archivos/${cobro.voucher.id}`}
                            target="_blank"
                            rel="noopener"
                            className="text-xs font-semibold text-marino-claro hover:underline"
                          >
                            Voucher: {cobro.voucher.nombre}
                          </a>
                        )}
                        {cobro.anulado ? <p className="text-xs text-rojo">Anulado: {cobro.motivoAnulacion}</p> : null}
                      </div>
                      {cobro.anulado ? <Insignia tono="neutro">Anulado</Insignia> : null}
                    </div>
                    {!cobro.anulado && !anulado && opciones.ok && opciones.datos.puedeAnular ? (
                      <details className="rounded-md border border-borde px-3 py-2">
                        <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-rojo">Anular cobro</summary>
                        <div className="pt-3">
                          <FormularioConfirmacion
                            accion={anularCobro.bind(null, ingreso.id, cobro.id)}
                            etiquetaBoton="Anular cobro"
                            textoPendiente="Anulando…"
                            variante="peligro"
                            pedirMotivo
                            consecuencia="El importe vuelve al saldo pendiente del ingreso."
                          />
                        </div>
                      </details>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>

        <div className="flex flex-col gap-6">
          {puedeRegistrar && ingreso.puedeCobrar ? (
            <Tarjeta titulo="Registrar cobro" descripcion={`Saldo pendiente: ${formatearMoneda(ingreso.saldo)}`}>
              <FormularioCobro
                accion={registrarCobro.bind(null, ingreso.id)}
                mediosPago={opciones.datos.mediosPago}
                saldo={ingreso.saldo}
                hoy={fechaHoyEnLima()}
              />
            </Tarjeta>
          ) : null}
          {puedeRegistrar ? (
            <Tarjeta
              titulo={ingreso.tipoComprobante === null ? 'Registrar comprobante' : 'Corregir comprobante'}
              descripcion="El comprobante se emite en el sistema de facturación; aquí solo se anota su número."
            >
              <FormularioComprobante accion={registrarComprobante.bind(null, ingreso.id)} fechaEmision={ingreso.fechaEmision} />
            </Tarjeta>
          ) : null}
          {ingreso.puedeAnular ? (
            <Tarjeta titulo="Anular ingreso" descripcion="Los ingresos no se eliminan. Si tiene cobros vigentes, anúlelos primero.">
              <FormularioConfirmacion
                accion={anularIngreso.bind(null, ingreso.id)}
                etiquetaBoton="Anular ingreso"
                textoPendiente="Anulando…"
                variante="peligro"
                pedirMotivo
                consecuencia="Deja de contar en la cobranza y en los reportes. Queda en la auditoría."
              />
            </Tarjeta>
          ) : null}
        </div>
      </div>
    </>
  );
}
