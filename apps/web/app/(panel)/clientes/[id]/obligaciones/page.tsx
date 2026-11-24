import {
  ETIQUETAS_GRUPO_CRONOGRAMA,
  esquemaFichaTributaria,
  esquemaHistorialTributario,
  esquemaOpcionesObligaciones,
} from '@sige/types';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EstadoObligacionInsignia } from '@/components/obligation-status';
import { solicitarApi } from '@/lib/api';
import { obtenerCliente } from '@/lib/client-data';
import { fechaHoyEnLima, formatearFecha } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { cambiarGrupoCliente, desactivarObligacionCliente, guardarObligacionCliente } from '../../../obligaciones/actions';
import { FilaObligacion, FormularioGrupo, FormularioObligacion } from './obligation-forms';

export const metadata: Metadata = { title: 'Obligaciones del cliente · TORRES ASOCIADOS' };

interface PropiedadesPaginaObligacionesCliente {
  params: Promise<{ id: string }>;
}

function periodoAnterior(hoy: string): string {
  const [anio, mes] = hoy.split('-').map(Number);
  return new Date(Date.UTC(anio ?? 2000, (mes ?? 1) - 2, 1)).toISOString().slice(0, 7);
}

export default async function PaginaObligacionesCliente({
  params,
}: PropiedadesPaginaObligacionesCliente): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'obligacion:ver')) {
    return <SinAcceso />;
  }

  const { id } = await params;
  const [cliente, ficha, opciones, historial] = await Promise.all([
    obtenerCliente(id),
    solicitarApi(`/obligaciones/clientes/${id}`, { esquema: esquemaFichaTributaria }),
    solicitarApi('/obligaciones/opciones', { esquema: esquemaOpcionesObligaciones }),
    solicitarApi(`/obligaciones/clientes/${id}/historial`, { esquema: esquemaHistorialTributario }),
  ]);

  if (!cliente.ok) {
    return null;
  }

  if (!ficha.ok) {
    return <Alerta tono="error">{ficha.error.mensaje}</Alerta>;
  }

  const datos = ficha.datos;
  const tipos = opciones.ok ? opciones.datos.tipos : [];
  const equipo = cliente.datos.asignaciones.map(({ usuario }) => ({ id: usuario.id, nombre: usuario.nombre }));
  const activas = datos.obligaciones.filter(({ activo }) => activo);
  const inactivas = datos.obligaciones.filter(({ activo }) => !activo);
  const disponibles = tipos.filter((tipo) => !activas.some((activa) => activa.tipoObligacion.id === tipo.id));
  const periodoInicial = periodoAnterior(fechaHoyEnLima());

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        {datos.ruc === null ? (
          <Alerta tono="aviso" titulo="Cliente sin RUC">
            Las obligaciones que usan el cronograma oficial se calculan con el último dígito del RUC. Registre el RUC en la
            pestaña General para poder configurarlas.
          </Alerta>
        ) : null}
        <Tarjeta
          titulo="Obligaciones configuradas"
          descripcion="Cada periodo se genera una obligación con su vencimiento y una tarea para el responsable."
          acciones={
            <Link
              href={`/obligaciones?vista=lista&clienteId=${datos.clienteId}`}
              className="text-sm font-semibold text-marino-claro hover:underline"
            >
              Ver vencimientos →
            </Link>
          }
        >
          {activas.length === 0 ? (
            <p className="text-sm text-apagado">Este cliente no tiene obligaciones configuradas.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borde">
              {activas.map((obligacion) => (
                <FilaObligacion
                  key={obligacion.id}
                  obligacion={obligacion}
                  puedeGestionar={datos.puedeGestionar}
                  editar={guardarObligacionCliente.bind(null, datos.clienteId, obligacion.id)}
                  desactivar={desactivarObligacionCliente.bind(null, datos.clienteId, obligacion.id)}
                  tipos={tipos}
                  equipo={equipo}
                />
              ))}
            </ul>
          )}
        </Tarjeta>
        {inactivas.length > 0 ? (
          <Tarjeta titulo="Obligaciones desactivadas" descripcion="Se conservan con su historial; ya no se generan.">
            <ul className="flex flex-col divide-y divide-borde">
              {inactivas.map((obligacion) => (
                <li key={obligacion.id} className="py-3 text-sm">
                  <p className="font-semibold text-tinta">{obligacion.tipoObligacion.nombre}</p>
                  <p className="text-apagado">
                    Desde {obligacion.desdePeriodo}
                    {obligacion.hastaPeriodo === null ? '' : ` hasta ${obligacion.hastaPeriodo}`} · {obligacion.responsable.nombre}
                  </p>
                </li>
              ))}
            </ul>
          </Tarjeta>
        ) : null}
        <Tarjeta
          titulo="Historial tributario"
          descripcion="Periodos generados con su presentación, constancia, rectificaciones y observaciones."
        >
          {historial.ok ? (
            historial.datos.periodos.length === 0 ? (
              <p className="text-sm text-apagado">Todavía no hay periodos generados.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-borde">
                {historial.datos.periodos.map((periodo) => (
                  <li key={periodo.id} className="flex flex-col gap-1 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/obligaciones/${periodo.id}`} className="font-semibold text-marino hover:underline">
                        {periodo.periodo} · {periodo.tipoObligacion.nombre}
                      </Link>
                      <EstadoObligacionInsignia estado={periodo.estado} vencida={periodo.vencida} />
                    </div>
                    <p className="text-xs text-apagado">
                      Vence el {formatearFecha(periodo.fechaVencimiento)}
                      {periodo.fechaPresentacion === null
                        ? ''
                        : ` · Presentada el ${formatearFecha(periodo.fechaPresentacion)}`}
                      {periodo.numeroOrden === null ? '' : ` · N.° ${periodo.numeroOrden}`}
                    </p>
                    {periodo.constancia === null ? null : (
                      <a
                        href={`/archivos/${periodo.constancia.id}`}
                        target="_blank"
                        rel="noopener"
                        className="text-xs font-semibold text-marino-claro hover:underline"
                      >
                        Constancia: {periodo.constancia.nombre}
                      </a>
                    )}
                    {periodo.observaciones === null ? null : <p className="text-xs text-tinta">{periodo.observaciones}</p>}
                    {periodo.rectificaciones.map((rectificacion) => (
                      <p key={rectificacion.id} className="text-xs text-tinta">
                        Rectificada el {formatearFecha(rectificacion.fechaPresentacion)}: {rectificacion.motivo} ·{' '}
                        <a
                          href={`/archivos/${rectificacion.constancia.id}`}
                          target="_blank"
                          rel="noopener"
                          className="font-semibold text-marino-claro hover:underline"
                        >
                          constancia
                        </a>
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            )
          ) : (
            <Alerta tono="error">{historial.error.mensaje}</Alerta>
          )}
        </Tarjeta>
      </div>
      <div className="flex flex-col gap-6">
        {datos.puedeGestionar ? (
          <>
            <Tarjeta titulo="Configurar obligación">
              {equipo.length === 0 ? (
                <p className="text-sm text-apagado">
                  Primero asigne usuarios al cliente en la pestaña Equipo: el responsable y el revisor deben estar asignados.
                </p>
              ) : disponibles.length === 0 ? (
                <p className="text-sm text-apagado">Todas las obligaciones activas ya están configuradas.</p>
              ) : (
                <FormularioObligacion
                  accion={guardarObligacionCliente.bind(null, datos.clienteId, null)}
                  tipos={disponibles}
                  equipo={equipo}
                  periodoInicial={periodoInicial}
                />
              )}
            </Tarjeta>
            <Tarjeta titulo="Cronograma">
              <FormularioGrupo accion={cambiarGrupoCliente.bind(null, datos.clienteId)} grupo={datos.grupoCronograma} />
            </Tarjeta>
          </>
        ) : (
          <Tarjeta titulo="Cronograma">
            <p className="text-sm text-tinta">
              Grupo: <span className="font-semibold">{ETIQUETAS_GRUPO_CRONOGRAMA[datos.grupoCronograma]}</span>
            </p>
          </Tarjeta>
        )}
      </div>
    </div>
  );
}
