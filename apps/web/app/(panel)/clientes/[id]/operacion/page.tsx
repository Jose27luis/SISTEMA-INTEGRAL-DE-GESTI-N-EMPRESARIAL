import { esquemaFichaOperativa } from '@sige/types';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Indicador } from '@/components/indicator-card';
import { EstadoObligacionInsignia } from '@/components/obligation-status';
import { solicitarApi } from '@/lib/api';
import { obtenerCliente } from '@/lib/client-data';
import { fechaHoyEnLima, formatearFechaHora } from '@/lib/format';
import { cambiarEstadoIncidencia, registrarIncidencia } from './actions';
import { FilaIncidencia, FormularioIncidencia } from './incident-forms';

export const metadata: Metadata = { title: 'Ficha operativa · TORRES ASOCIADOS' };

interface PropiedadesPaginaOperacion {
  params: Promise<{ id: string }>;
}

export default async function PaginaOperacion({ params }: PropiedadesPaginaOperacion): Promise<ReactNode> {
  const { id } = await params;
  const [cliente, ficha] = await Promise.all([
    obtenerCliente(id),
    solicitarApi(`/clientes/${id}/ficha-operativa`, { esquema: esquemaFichaOperativa }),
  ]);

  if (!cliente.ok) {
    return null;
  }

  if (!ficha.ok) {
    return <Alerta tono="error">{ficha.error.mensaje}</Alerta>;
  }

  const datos = ficha.datos;
  const equipo = cliente.datos.asignaciones.map(({ usuario }) => ({ id: usuario.id, nombre: usuario.nombre }));
  const abiertas = datos.incidencias.filter(({ estado }) => estado === 'ABIERTA' || estado === 'EN_ATENCION');
  const cerradas = datos.incidencias.filter(({ estado }) => estado === 'RESUELTA' || estado === 'ANULADA');

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Resumen operativo" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador etiqueta="Tareas abiertas" valor={datos.tareasAbiertas} enlace={`/tareas?clienteId=${id}&estado=ABIERTAS`} />
        <Indicador etiqueta="Documentación recibida" valor={datos.documentacion.recibida} enlace={`/clientes/${id}/documentos`} />
        <Indicador
          etiqueta="Documentación pendiente"
          valor={datos.documentacion.pendiente}
          detalle={`${String(datos.documentacion.atrasada)} con el plazo vencido`}
          tono={datos.documentacion.atrasada > 0 ? 'alerta' : 'normal'}
          enlace={`/clientes/${id}/documentos`}
        />
        <Indicador
          etiqueta="Incidencias abiertas"
          valor={abiertas.length}
          tono={abiertas.length > 0 ? 'alerta' : 'normal'}
        />
      </section>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Tarjeta titulo="Obligaciones mensuales" descripcion="Estado del último periodo generado de cada obligación.">
            {datos.obligaciones.length === 0 ? (
              <p className="text-sm text-apagado">No tiene obligaciones configuradas.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-borde">
                {datos.obligaciones.map((obligacion) => (
                  <li key={obligacion.tipo} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div>
                      <p className="font-semibold text-tinta">{obligacion.tipo}</p>
                      <p className="text-xs text-apagado">
                        {obligacion.responsable} · {obligacion.ultimoPeriodo ?? 'Sin periodos generados'}
                      </p>
                    </div>
                    {obligacion.estado === null ? null : (
                      <EstadoObligacionInsignia estado={obligacion.estado} vencida={obligacion.vencida} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
          <Tarjeta titulo={`Incidencias abiertas (${String(abiertas.length)})`}>
            {abiertas.length === 0 ? (
              <p className="text-sm text-apagado">No hay incidencias abiertas.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-borde">
                {abiertas.map((incidencia) => (
                  <FilaIncidencia
                    key={incidencia.id}
                    incidencia={incidencia}
                    cambiar={datos.puedeGestionarIncidencias ? cambiarEstadoIncidencia.bind(null, id, incidencia.id) : null}
                  />
                ))}
              </ul>
            )}
          </Tarjeta>
          {cerradas.length > 0 ? (
            <Tarjeta titulo="Incidencias cerradas">
              <ul className="flex flex-col divide-y divide-borde">
                {cerradas.map((incidencia) => (
                  <FilaIncidencia key={incidencia.id} incidencia={incidencia} cambiar={null} />
                ))}
              </ul>
            </Tarjeta>
          ) : null}
        </div>
        <div className="flex flex-col gap-6">
          {datos.puedeGestionarIncidencias ? (
            <Tarjeta titulo="Registrar incidencia">
              {equipo.length === 0 ? (
                <p className="text-sm text-apagado">Asigne primero al equipo del cliente.</p>
              ) : (
                <FormularioIncidencia accion={registrarIncidencia.bind(null, id)} equipo={equipo} fechaHoy={fechaHoyEnLima()} />
              )}
            </Tarjeta>
          ) : null}
          <Tarjeta titulo="Actividades ejecutadas" descripcion="Últimas tareas completadas del cliente.">
            {datos.actividades.length === 0 ? (
              <p className="text-sm text-apagado">Todavía no hay tareas completadas.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-borde">
                {datos.actividades.map((actividad) => (
                  <li key={actividad.tareaId} className="py-2 text-sm">
                    <Link href={`/tareas/${actividad.tareaId}`} className="font-semibold text-marino hover:underline">
                      {actividad.codigo} · {actividad.titulo}
                    </Link>
                    <p className="text-xs text-apagado">
                      {actividad.responsable} · {formatearFechaHora(actividad.completadaEn)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}
