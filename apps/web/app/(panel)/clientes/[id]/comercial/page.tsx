import { esquemaFichaComercial, esquemaOpcionesFinanzas, esquemaPaginaDocumentos } from '@sige/types';
import { Alerta, Insignia, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { EstadoCobro } from '@/components/collection-status';
import { Indicador } from '@/components/indicator-card';
import { SinAcceso } from '@/components/no-access';
import { solicitarApi } from '@/lib/api';
import { fechaHoyEnLima, formatearFecha, formatearMoneda } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { darDeBajaServicio, guardarContrato, guardarServicioContratado } from '../../../finanzas/actions';
import { FilaServicio, FormularioContrato, FormularioServicio } from './commercial-forms';

export const metadata: Metadata = { title: 'Ficha comercial · TORRES ASOCIADOS' };

export default async function PaginaFichaComercial({ params }: { params: Promise<{ id: string }> }): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'comercial:ver')) {
    return <SinAcceso />;
  }

  const { id } = await params;
  const [ficha, opciones, documentos] = await Promise.all([
    solicitarApi(`/clientes/${id}/ficha-comercial`, { esquema: esquemaFichaComercial }),
    solicitarApi('/finanzas/opciones', { esquema: esquemaOpcionesFinanzas }),
    tienePermiso(perfil, 'documento:ver')
      ? solicitarApi(`/documentos?clienteId=${id}&pagina=1`, { esquema: esquemaPaginaDocumentos })
      : Promise.resolve(null),
  ]);

  if (!ficha.ok) {
    return <Alerta tono="error">{ficha.error.mensaje}</Alerta>;
  }

  const datos = ficha.datos;
  const hoy = fechaHoyEnLima();
  const servicios = opciones.ok ? opciones.datos.servicios.map(({ id: servicioId, nombre }) => ({ id: servicioId, nombre })) : [];
  const listaDocumentos = documentos?.ok === true ? documentos.datos.elementos.map(({ id: documentoId, titulo }) => ({ id: documentoId, titulo })) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador etiqueta="Honorario mensual" valor={formatearMoneda(datos.honorarioMensual)} detalle="Servicios mensuales vigentes" />
        <Indicador etiqueta="Facturado" valor={formatearMoneda(datos.pagos.facturado)} detalle="Histórico, sin anulados" />
        <Indicador etiqueta="Cobrado" valor={formatearMoneda(datos.pagos.cobrado)} tono="exito" />
        <Indicador
          etiqueta="Saldo pendiente"
          valor={formatearMoneda(datos.pagos.saldo)}
          tono={datos.pagos.saldo > 0 ? 'alerta' : 'normal'}
          enlace={`/finanzas/ingresos?clienteId=${id}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Tarjeta titulo="Servicios contratados">
            {datos.servicios.length === 0 ? (
              <p className="text-sm text-apagado">No hay servicios contratados.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-borde">
                {datos.servicios.map((contratado) => (
                  <FilaServicio
                    key={contratado.id}
                    contratado={contratado}
                    editar={guardarServicioContratado.bind(null, id, contratado.id)}
                    darDeBaja={darDeBajaServicio.bind(null, id, contratado.id)}
                    servicios={servicios}
                    puedeGestionar={datos.puedeGestionar}
                    hoy={hoy}
                  />
                ))}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta
            titulo="Historial de pagos"
            acciones={
              datos.puedeRegistrarIngresos ? (
                <Link href={`/finanzas/ingresos/nuevo?clienteId=${id}`} className="text-sm font-semibold text-marino-claro hover:underline">
                  Registrar ingreso
                </Link>
              ) : null
            }
          >
            {datos.ingresos.length === 0 ? (
              <p className="text-sm text-apagado">No hay ingresos registrados.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-borde">
                {datos.ingresos.map((ingreso) => (
                  <li key={ingreso.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <Link href={`/finanzas/ingresos/${ingreso.id}`} className="font-semibold text-marino hover:underline">
                        {ingreso.concepto}
                      </Link>
                      <p className="text-xs text-apagado">
                        Vence {formatearFecha(ingreso.fechaVencimiento)} · {formatearMoneda(ingreso.monto)} · saldo{' '}
                        {formatearMoneda(ingreso.saldo)}
                      </p>
                    </div>
                    <EstadoCobro estado={ingreso.estado} diasVencido={ingreso.diasVencido} />
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>

        <div className="flex flex-col gap-6">
          <Tarjeta titulo="Contrato">
            {datos.contrato === null ? null : (
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                <span>
                  Desde {formatearFecha(datos.contrato.inicio)}
                  {datos.contrato.vencimiento === null ? ' · sin vencimiento' : ` hasta ${formatearFecha(datos.contrato.vencimiento)}`}
                </span>
                {datos.contrato.vencido ? <Insignia tono="peligro">Contrato vencido</Insignia> : null}
                {datos.contrato.documento === null ? null : (
                  <Link href={`/documentos/${datos.contrato.documento.id}`} className="font-semibold text-marino-claro hover:underline">
                    Ver contrato firmado
                  </Link>
                )}
              </div>
            )}
            {datos.puedeGestionar ? (
              <FormularioContrato accion={guardarContrato.bind(null, id)} contrato={datos.contrato} documentos={listaDocumentos} />
            ) : datos.contrato === null ? (
              <p className="text-sm text-apagado">No hay contrato registrado.</p>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-apagado">Día de pago</dt>
                <dd>{datos.contrato.diaPago}</dd>
                <dt className="text-apagado">Condiciones</dt>
                <dd className="whitespace-pre-line">{datos.contrato.condicionesPago ?? 'Sin detalle'}</dd>
                <dt className="text-apagado">Observaciones</dt>
                <dd className="whitespace-pre-line">{datos.contrato.observaciones ?? 'Sin observaciones'}</dd>
              </dl>
            )}
          </Tarjeta>

          {datos.puedeGestionar ? (
            <Tarjeta titulo="Agregar servicio">
              {servicios.length === 0 ? (
                <p className="text-sm text-apagado">Configure primero el catálogo de servicios.</p>
              ) : (
                <FormularioServicio accion={guardarServicioContratado.bind(null, id, null)} servicios={servicios} hoy={hoy} />
              )}
            </Tarjeta>
          ) : null}
        </div>
      </div>
    </div>
  );
}
