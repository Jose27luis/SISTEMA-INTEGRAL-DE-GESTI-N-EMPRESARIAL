import { esquemaOpcionesProyecto, esquemaProyectoDetalle, ETIQUETAS_ESTADO_ENTREGABLE, ETIQUETAS_ESTADO_ETAPA } from '@sige/types';
import { cn } from '@sige/ui/cn';
import { Alerta, Insignia, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Indicador } from '@/components/indicator-card';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { BarraAvance, EstadoProyectoInsignia } from '@/components/project-status';
import { solicitarApi } from '@/lib/api';
import { fechaHoyEnLima, formatearFecha, formatearFechaHora, formatearMoneda } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import {
  cambiarEstadoProyecto,
  crearEntregable,
  editarProyecto,
  entregarArchivo,
  guardarEtapa,
  moverEtapa,
  reportarDificultad,
  revisarEntregable,
} from '../actions';
import {
  BotonMover,
  FormularioDificultad,
  FormularioEntrega,
  FormularioEntregable,
  FormularioEstadoProyecto,
  FormularioEtapa,
  FormularioProyecto,
  FormularioRevisionEntregable,
} from '../project-forms';
import { Cronograma, Tablero } from './project-views';

export const metadata: Metadata = { title: 'Proyecto · TORRES ASOCIADOS' };

const VISTAS = [
  { clave: 'resumen', etiqueta: 'Etapas y entregables' },
  { clave: 'cronograma', etiqueta: 'Cronograma' },
  { clave: 'tablero', etiqueta: 'Tablero de tareas' },
  { clave: 'datos', etiqueta: 'Datos del proyecto' },
] as const;

const TONOS_ENTREGABLE = { PENDIENTE: 'neutro', ENTREGADO: 'info', OBSERVADO: 'peligro', APROBADO: 'exito' } as const;

interface PropiedadesPaginaProyecto {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vista?: string | string[] }>;
}

export default async function PaginaProyecto({ params, searchParams }: PropiedadesPaginaProyecto): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'proyecto:ver')) {
    return <SinAcceso />;
  }

  const [{ id }, { vista: crudo }] = await Promise.all([params, searchParams]);
  const resultado = await solicitarApi(`/proyectos/${id}`, { esquema: esquemaProyectoDetalle });

  if (!resultado.ok) {
    return <Alerta tono="error">{resultado.error.mensaje}</Alerta>;
  }

  const proyecto = resultado.datos;
  const vista = VISTAS.find(({ clave }) => clave === (Array.isArray(crudo) ? crudo[0] : crudo)) ?? VISTAS[0];
  const hoy = fechaHoyEnLima();
  const opciones =
    vista.clave === 'datos' && proyecto.permisos.editar
      ? await solicitarApi('/proyectos/opciones', { esquema: esquemaOpcionesProyecto })
      : null;
  const enEquipo = proyecto.responsable.id === perfil.usuario.id || proyecto.miembros.some(({ id: miembroId }) => miembroId === perfil.usuario.id);
  const puedeReportar = proyecto.permisos.entregar && (perfil.alcanceGlobal || enEquipo);

  return (
    <>
      <EncabezadoPagina
        antetitulo={
          <Link href="/proyectos" className="text-sm font-medium text-marino-claro hover:underline">
            ← Proyectos
          </Link>
        }
        titulo={`${proyecto.codigo} · ${proyecto.nombre}`}
        descripcion={`${proyecto.cliente?.razonSocial ?? 'Proyecto interno'} · Responsable: ${proyecto.responsable.nombre}`}
        acciones={
          <EstadoProyectoInsignia estado={proyecto.estado} atrasado={proyecto.atrasado} conDificultades={proyecto.conDificultades} />
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador etiqueta="Avance" valor={`${String(proyecto.avance)} %`} detalle={`${String(proyecto.tareas)} tareas vigentes`} />
        <Indicador
          etiqueta="Entrega"
          valor={formatearFecha(proyecto.fechaEntrega)}
          detalle={`Inicio ${formatearFecha(proyecto.fechaInicio)}`}
          tono={proyecto.atrasado ? 'alerta' : 'normal'}
        />
        <Indicador
          etiqueta="Presupuesto"
          valor={proyecto.presupuesto === null ? 'Sin definir' : formatearMoneda(proyecto.presupuesto)}
          detalle={`Egresos: ${formatearMoneda(proyecto.egresos)}`}
          tono={proyecto.presupuesto !== null && proyecto.egresos > proyecto.presupuesto ? 'alerta' : 'normal'}
        />
        <Indicador
          etiqueta="Honorarios"
          valor={proyecto.honorarios === null ? 'Sin definir' : formatearMoneda(proyecto.honorarios)}
          detalle={proyecto.servicio?.nombre ?? 'Sin servicio'}
        />
      </div>

      {proyecto.conDificultades ? (
        <Alerta tono="error" titulo="Proyecto con dificultades" className="mb-6">
          {proyecto.detalleDificultad}
        </Alerta>
      ) : null}
      {proyecto.resultadoFinal === null ? null : (
        <Alerta tono={proyecto.estado === 'FINALIZADO' ? 'exito' : 'aviso'} titulo={proyecto.estado === 'FINALIZADO' ? 'Resultado final' : 'Proyecto cancelado'} className="mb-6">
          {proyecto.resultadoFinal}
        </Alerta>
      )}

      <nav aria-label="Vistas del proyecto" className="mb-6 overflow-x-auto border-b border-borde">
        <ul className="flex min-w-max gap-1">
          {VISTAS.map((opcion) => (
            <li key={opcion.clave}>
              <Link
                href={`/proyectos/${id}?vista=${opcion.clave}`}
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

      {vista.clave === 'cronograma' ? (
        <Tarjeta titulo="Cronograma" descripcion="Etapas y sus tareas en el tiempo.">
          <Cronograma proyecto={proyecto} hoy={hoy} />
        </Tarjeta>
      ) : vista.clave === 'tablero' ? (
        <Tablero proyecto={proyecto} />
      ) : vista.clave === 'datos' ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Tarjeta titulo="Datos del proyecto">
            {opciones?.ok === true ? (
              <FormularioProyecto
                accion={editarProyecto.bind(null, id)}
                opciones={opciones.datos}
                proyecto={proyecto}
                hoy={hoy}
                usuarioId={proyecto.responsable.id}
              />
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                <dt className="text-apagado">Objetivo</dt>
                <dd className="whitespace-pre-line">{proyecto.objetivo ?? 'Sin objetivo registrado'}</dd>
                <dt className="text-apagado">Descripción</dt>
                <dd className="whitespace-pre-line">{proyecto.descripcion ?? 'Sin descripción'}</dd>
                <dt className="text-apagado">Equipo</dt>
                <dd>{[proyecto.responsable.nombre, ...proyecto.miembros.map(({ nombre }) => nombre)].join(', ')}</dd>
                <dt className="text-apagado">Creado</dt>
                <dd>
                  {proyecto.creadoPor} · {formatearFechaHora(proyecto.creadoEn)}
                </dd>
              </dl>
            )}
          </Tarjeta>
          <div className="flex flex-col gap-6">
            {proyecto.permisos.transiciones.length > 0 ? (
              <Tarjeta titulo="Estado del proyecto" descripcion="Para finalizar, todas sus tareas deben estar cerradas o canceladas.">
                <FormularioEstadoProyecto accion={cambiarEstadoProyecto.bind(null, id)} transiciones={proyecto.permisos.transiciones} />
              </Tarjeta>
            ) : null}
            {puedeReportar ? (
              <Tarjeta titulo="Dificultades">
                <FormularioDificultad
                  accion={reportarDificultad.bind(null, id)}
                  conDificultades={proyecto.conDificultades}
                  detalle={proyecto.detalleDificultad}
                />
              </Tarjeta>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {proyecto.etapas.length === 0 ? (
            <Alerta tono="info">El proyecto todavía no tiene etapas.</Alerta>
          ) : (
            proyecto.etapas.map((etapa, indice) => (
              <Tarjeta
                key={etapa.id}
                titulo={`${String(etapa.orden)}. ${etapa.nombre}`}
                descripcion={`${formatearFecha(etapa.inicio)} a ${formatearFecha(etapa.fin)} · ${ETIQUETAS_ESTADO_ETAPA[etapa.estado]}`}
                acciones={
                  <div className="flex items-center gap-2">
                    <BarraAvance avance={etapa.avance} />
                    {proyecto.permisos.editar && indice > 0 ? (
                      <BotonMover accion={moverEtapa.bind(null, id, etapa.id, 'subir')} etiqueta="Subir" />
                    ) : null}
                    {proyecto.permisos.editar && indice < proyecto.etapas.length - 1 ? (
                      <BotonMover accion={moverEtapa.bind(null, id, etapa.id, 'bajar')} etiqueta="Bajar" />
                    ) : null}
                  </div>
                }
              >
                <div className="grid gap-6 lg:grid-cols-2">
                  <section aria-label="Tareas de la etapa">
                    <h3 className="mb-2 flex items-center justify-between text-sm font-semibold text-marino">
                      Tareas
                      {proyecto.permisos.crearTareas ? (
                        <Link
                          href={`/tareas/nueva?proyecto=${id}&etapa=${etapa.id}`}
                          className="text-sm font-semibold text-marino-claro hover:underline"
                        >
                          Nueva tarea
                        </Link>
                      ) : null}
                    </h3>
                    {proyecto.tareasDetalle.filter(({ etapaId }) => etapaId === etapa.id).length === 0 ? (
                      <p className="text-sm text-apagado">Sin tareas.</p>
                    ) : (
                      <ul className="flex flex-col divide-y divide-borde text-sm">
                        {proyecto.tareasDetalle
                          .filter(({ etapaId }) => etapaId === etapa.id)
                          .map((tarea) => (
                            <li key={tarea.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                              <Link href={`/tareas/${tarea.id}`} className="font-medium text-marino hover:underline">
                                {tarea.codigo} · {tarea.titulo}
                              </Link>
                              <span className={cn('text-xs', tarea.atrasada ? 'font-semibold text-rojo' : 'text-apagado')}>
                                {tarea.responsable.nombre} · {tarea.porcentajeAvance} % · vence {formatearFecha(tarea.fechaLimite)}
                              </span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </section>
                  <section aria-label="Entregables de la etapa">
                    <h3 className="mb-2 text-sm font-semibold text-marino">Entregables</h3>
                    {etapa.entregables.length === 0 ? (
                      <p className="text-sm text-apagado">Sin entregables.</p>
                    ) : (
                      <ul className="flex flex-col divide-y divide-borde text-sm">
                        {etapa.entregables.map((entregable) => (
                          <li key={entregable.id} className="flex flex-col gap-2 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium text-tinta">{entregable.nombre}</span>
                              <span className="inline-flex gap-1">
                                <Insignia tono={TONOS_ENTREGABLE[entregable.estado]}>{ETIQUETAS_ESTADO_ENTREGABLE[entregable.estado]}</Insignia>
                                {entregable.vencido ? <Insignia tono="peligro">Vencido</Insignia> : null}
                              </span>
                            </div>
                            <p className="text-xs text-apagado">
                              Compromiso {formatearFecha(entregable.fechaCompromiso)}
                              {entregable.entregadoPor === null ? '' : ` · entregó ${entregable.entregadoPor}`}
                              {entregable.revisadoPor === null ? '' : ` · revisó ${entregable.revisadoPor}`}
                            </p>
                            {entregable.archivo === null ? null : (
                              <a
                                href={`/archivos/${entregable.archivo.id}`}
                                target="_blank"
                                rel="noopener"
                                className="text-xs font-semibold text-marino-claro hover:underline"
                              >
                                {entregable.archivo.nombre}
                              </a>
                            )}
                            {entregable.comentario === null ? null : (
                              <p className="text-xs whitespace-pre-line text-tinta">{entregable.comentario}</p>
                            )}
                            {proyecto.permisos.entregar && entregable.estado !== 'APROBADO' ? (
                              <details className="rounded-md border border-borde px-3 py-2">
                                <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-marino">
                                  {entregable.archivo === null ? 'Entregar' : 'Entregar otra versión'}
                                </summary>
                                <div className="pt-2">
                                  <FormularioEntrega accion={entregarArchivo.bind(null, id, entregable.id)} />
                                </div>
                              </details>
                            ) : null}
                            {proyecto.permisos.aprobar && entregable.estado === 'ENTREGADO' ? (
                              <details className="rounded-md border border-borde px-3 py-2" open>
                                <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-marino">Revisar</summary>
                                <div className="pt-2">
                                  <FormularioRevisionEntregable accion={revisarEntregable.bind(null, id, entregable.id)} />
                                </div>
                              </details>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                    {proyecto.permisos.editar ? (
                      <div className="mt-3 border-t border-borde pt-3">
                        <FormularioEntregable accion={crearEntregable.bind(null, id, etapa.id)} fin={etapa.fin} />
                      </div>
                    ) : null}
                  </section>
                </div>
                {proyecto.permisos.editar ? (
                  <details className="mt-4 rounded-md border border-borde px-3 py-2">
                    <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-marino">Editar etapa</summary>
                    <div className="pt-2">
                      <FormularioEtapa accion={guardarEtapa.bind(null, id, etapa.id)} etapa={etapa} hoy={hoy} />
                    </div>
                  </details>
                ) : null}
              </Tarjeta>
            ))
          )}
          {proyecto.permisos.editar ? (
            <Tarjeta titulo="Agregar etapa" descripcion="Las tareas del proyecto se crean dentro de una etapa.">
              <FormularioEtapa accion={guardarEtapa.bind(null, id, null)} hoy={hoy} />
            </Tarjeta>
          ) : null}
        </div>
      )}
    </>
  );
}
