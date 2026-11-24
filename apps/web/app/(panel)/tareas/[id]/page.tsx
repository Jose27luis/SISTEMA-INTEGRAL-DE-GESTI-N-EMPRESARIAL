import { ETIQUETAS_ESTADO_TAREA, esquemaTareaDetalle } from '@sige/types';
import { Alerta, Insignia, Tarjeta } from '@sige/ui/components';
import { Download, Eye, FileText } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { FormularioConfirmacion } from '@/components/confirm-action-form';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { BarraAvance, EstadoTareaInsignia, PrioridadInsignia } from '@/components/task-badges';
import { solicitarApi } from '@/lib/api';
import { formatearFecha, formatearFechaHora, formatearMinutos, formatearTamano } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import {
  cancelarTarea,
  comentarTarea,
  enviarTarea,
  finalizarTarea,
  iniciarTarea,
  registrarAvance,
  revisarTarea,
} from '../actions';
import { FormularioComentario } from './comment-form';
import { FormularioAvance } from './progress-form';
import { FormularioEnvio, FormularioRevision } from './review-forms';
import { BotonIniciar } from './start-button';

export const metadata: Metadata = { title: 'Tarea · TORRES ASOCIADOS' };

const TIPOS_CON_VISTA = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

interface PropiedadesPaginaTarea {
  params: Promise<{ id: string }>;
}

export default async function PaginaTarea({ params }: PropiedadesPaginaTarea): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'tarea:ver')) {
    return <SinAcceso />;
  }

  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const resultado = await solicitarApi(`/tareas/${id}`, { esquema: esquemaTareaDetalle });

  if (!resultado.ok) {
    if (resultado.estado === 404) {
      notFound();
    }

    return <Alerta tono="error">{resultado.error.mensaje}</Alerta>;
  }

  const tarea = resultado.datos;
  const corregibles = tarea.avances.map((avance) => ({
    id: avance.id,
    etiqueta: `${formatearFechaHora(avance.registradoEn)} · ${avance.actividad}`,
  }));

  return (
    <>
      <EncabezadoPagina
        antetitulo={
          <Link href="/tareas" className="text-sm font-medium text-marino-claro hover:underline">
            ← Tareas
          </Link>
        }
        titulo={tarea.titulo}
        descripcion={`${tarea.codigo} · ${tarea.cliente?.nombre ?? 'Tarea interna'}`}
        acciones={
          <div className="flex flex-wrap items-start gap-2">
            {tarea.acciones.editar ? (
              <Link
                href={`/tareas/${tarea.id}/editar`}
                className="inline-flex min-h-11 items-center rounded-md border border-borde bg-superficie px-4 text-sm font-semibold text-marino hover:border-marino-claro"
              >
                Editar
              </Link>
            ) : null}
            {tarea.acciones.iniciar ? <BotonIniciar accion={iniciarTarea.bind(null, tarea.id)} /> : null}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          {tarea.atrasada ? (
            <Alerta tono="error" titulo="Tarea atrasada">
              Venció el {formatearFecha(tarea.fechaLimite)}. Registre un avance o coordine una nueva fecha con quien la
              asignó.
            </Alerta>
          ) : null}

          <Tarjeta titulo="Instrucciones">
            <p className="text-sm whitespace-pre-line text-tinta">
              {tarea.instrucciones ?? 'Sin instrucciones adicionales.'}
            </p>
            {tarea.requiereEvidencia && tarea.evidenciaRequerida !== null ? (
              <p className="mt-4 rounded-md bg-dorado-suave px-3 py-2 text-sm text-dorado-oscuro">
                <span className="font-semibold">Evidencia requerida:</span> {tarea.evidenciaRequerida}
              </p>
            ) : null}
          </Tarjeta>

          {tarea.estado === 'CANCELADA' && tarea.motivoCancelacion !== null ? (
            <Alerta tono="aviso" titulo="Tarea cancelada">
              {tarea.motivoCancelacion}
            </Alerta>
          ) : null}

          {tarea.estado === 'OBSERVADA' && tarea.rondas[0]?.decision === 'OBSERVADA' ? (
            <Alerta tono="error" titulo={`Observación de ${tarea.rondas[0].revisor.nombre}`}>
              {tarea.rondas[0].comentario}
              {tarea.acciones.registrarAvance
                ? ' Registre un avance con la corrección y luego reenvíela a revisión.'
                : ''}
            </Alerta>
          ) : null}

          {tarea.acciones.revisar ? (
            <Tarjeta
              titulo="Revisar trabajo"
              descripcion={`Ronda ${String(tarea.rondas.length + 1)}. Revise los avances y evidencias antes de decidir.`}
            >
              <FormularioRevision accion={revisarTarea.bind(null, tarea.id)} />
            </Tarjeta>
          ) : null}

          {tarea.acciones.enviar ? (
            <Tarjeta titulo={tarea.estado === 'CORREGIDA' ? 'Reenviar a revisión' : 'Terminar tarea'}>
              <FormularioEnvio
                accion={enviarTarea.bind(null, tarea.id)}
                requiereAprobacion={tarea.requiereAprobacion}
                esCorreccion={tarea.estado === 'CORREGIDA'}
                faltaEvidencia={
                  tarea.requiereEvidencia && tarea.evidenciasAdjuntas === 0
                    ? (tarea.evidenciaRequerida ?? 'archivos de respaldo')
                    : null
                }
              />
            </Tarjeta>
          ) : null}

          {tarea.acciones.finalizar ? (
            <Tarjeta titulo="Finalizar tarea" descripcion="El trabajo ya fue aprobado.">
              <FormularioConfirmacion
                accion={finalizarTarea.bind(null, tarea.id)}
                etiquetaBoton="Finalizar"
                textoPendiente="Finalizando…"
                variante="primario"
                consecuencia="La tarea queda cerrada como Finalizada."
              />
            </Tarjeta>
          ) : null}

          {tarea.acciones.registrarAvance ? (
            <Tarjeta titulo="Registrar avance" descripcion="Cada avance queda registrado con su fecha y no se edita.">
              <FormularioAvance
                accion={registrarAvance.bind(null, tarea.id)}
                porcentajeActual={tarea.porcentajeAvance}
                evidenciaRequerida={tarea.requiereEvidencia ? tarea.evidenciaRequerida : null}
                corregibles={corregibles}
              />
            </Tarjeta>
          ) : null}

          <Tarjeta titulo={`Avances (${String(tarea.avances.length)})`}>
            {tarea.avances.length === 0 ? (
              <p className="text-sm text-apagado">Todavía no hay avances registrados.</p>
            ) : (
              <ol className="relative flex flex-col gap-6 border-l-2 border-borde pl-6">
                {tarea.avances.map((avance) => (
                  <li key={avance.id} className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute top-1 -left-[1.95rem] size-3.5 rounded-full border-2 border-superficie bg-marino-claro"
                    />
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold text-marino">{avance.actividad}</p>
                      <span className="text-xs text-apagado">{formatearFechaHora(avance.registradoEn)}</span>
                    </div>
                    <p className="text-xs text-apagado">
                      {avance.autor.nombre} · {avance.porcentaje} % · {formatearMinutos(avance.minutosDedicados)}
                      {avance.corrigeAId === null ? '' : ' · Corrige un avance anterior'}
                    </p>
                    <p className="mt-2 text-sm whitespace-pre-line text-tinta">{avance.descripcion}</p>
                    <dl className="mt-2 flex flex-col gap-1 text-sm">
                      {avance.dificultades === null ? null : (
                        <div>
                          <dt className="inline font-semibold text-tinta">Dificultades: </dt>
                          <dd className="inline text-apagado">{avance.dificultades}</dd>
                        </div>
                      )}
                      {avance.observaciones === null ? null : (
                        <div>
                          <dt className="inline font-semibold text-tinta">Observaciones: </dt>
                          <dd className="inline text-apagado">{avance.observaciones}</dd>
                        </div>
                      )}
                      {avance.proximoPaso === null ? null : (
                        <div>
                          <dt className="inline font-semibold text-tinta">Próximo paso: </dt>
                          <dd className="inline text-apagado">{avance.proximoPaso}</dd>
                        </div>
                      )}
                    </dl>
                    {avance.evidencias.length === 0 ? null : (
                      <ul className="mt-3 flex flex-col gap-2">
                        {avance.evidencias.map((evidencia) => (
                          <li
                            key={evidencia.id}
                            className="flex items-center gap-3 rounded-md border border-borde px-3 py-2 text-sm"
                          >
                            <FileText aria-hidden="true" className="size-4 shrink-0 text-apagado" />
                            <span className="min-w-0 flex-1 truncate text-tinta">{evidencia.nombre}</span>
                            <span className="shrink-0 text-xs text-apagado">{formatearTamano(evidencia.tamanoBytes)}</span>
                            {TIPOS_CON_VISTA.has(evidencia.mime) ? (
                              <a
                                href={`/archivos/${evidencia.id}`}
                                target="_blank"
                                rel="noopener"
                                aria-label={`Ver ${evidencia.nombre}`}
                                className="inline-flex size-9 items-center justify-center rounded-md text-marino-claro hover:bg-marino/5"
                              >
                                <Eye aria-hidden="true" className="size-4" />
                              </a>
                            ) : null}
                            <a
                              href={`/archivos/${evidencia.id}?descarga=1`}
                              aria-label={`Descargar ${evidencia.nombre}`}
                              className="inline-flex size-9 items-center justify-center rounded-md text-marino-claro hover:bg-marino/5"
                            >
                              <Download aria-hidden="true" className="size-4" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Tarjeta>

          <section id="comentarios" className="scroll-mt-6">
            <Tarjeta titulo={`Comentarios (${String(tarea.comentarios.length)})`}>
              <div className="flex flex-col gap-6">
                {tarea.comentarios.length === 0 ? null : (
                  <ul className="flex flex-col gap-4">
                    {tarea.comentarios.map((comentario) => (
                      <li key={comentario.id} className="rounded-md bg-fondo px-4 py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm font-semibold text-marino">{comentario.autor.nombre}</p>
                          <span className="text-xs text-apagado">{formatearFechaHora(comentario.creadoEn)}</span>
                        </div>
                        <p className="mt-1 text-sm whitespace-pre-line text-tinta">{comentario.contenido}</p>
                        {comentario.mencionados.length === 0 ? null : (
                          <p className="mt-2 text-xs text-marino-claro">
                            Para: {comentario.mencionados.map(({ nombre }) => nombre).join(', ')}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {tarea.acciones.comentar ? (
                  <FormularioComentario
                    accion={comentarTarea.bind(null, tarea.id)}
                    participantes={tarea.participantes.filter(({ id: participanteId }) => participanteId !== perfil.usuario.id)}
                  />
                ) : null}
              </div>
            </Tarjeta>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <Tarjeta titulo="Resumen">
            <div className="mb-4 flex flex-wrap gap-2">
              <EstadoTareaInsignia estado={tarea.estado} />
              <PrioridadInsignia prioridad={tarea.prioridad} />
            </div>
            <BarraAvance porcentaje={tarea.porcentajeAvance} className="mb-4" />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
              <dt className="text-apagado">Responsable</dt>
              <dd className="font-medium">{tarea.responsable.nombre}</dd>
              <dt className="text-apagado">Colaboradores</dt>
              <dd>{tarea.colaboradores.length === 0 ? 'Ninguno' : tarea.colaboradores.map(({ nombre }) => nombre).join(', ')}</dd>
              <dt className="text-apagado">Revisor</dt>
              <dd>{tarea.revisor?.nombre ?? (tarea.requiereAprobacion ? 'Por definir' : 'No requiere aprobación')}</dd>
              <dt className="text-apagado">Asignada por</dt>
              <dd>{tarea.asignadoPor.nombre}</dd>
              <dt className="text-apagado">Cliente</dt>
              <dd>
                {tarea.cliente === null ? (
                  'Tarea interna'
                ) : (
                  <Link href={`/clientes/${tarea.cliente.id}`} className="text-marino-claro hover:underline">
                    {tarea.cliente.nombre}
                  </Link>
                )}
              </dd>
              <dt className="text-apagado">Inicio</dt>
              <dd>{tarea.fechaInicio === null ? 'Sin definir' : formatearFecha(tarea.fechaInicio)}</dd>
              <dt className="text-apagado">Fecha límite</dt>
              <dd className={tarea.atrasada ? 'font-semibold text-rojo' : undefined}>{formatearFecha(tarea.fechaLimite)}</dd>
              <dt className="text-apagado">Tiempo registrado</dt>
              <dd>{formatearMinutos(tarea.minutosRegistrados)}</dd>
              <dt className="text-apagado">Creada</dt>
              <dd>{formatearFechaHora(tarea.creadoEn)}</dd>
            </dl>
          </Tarjeta>

          {tarea.rondas.length === 0 ? null : (
            <Tarjeta titulo="Rondas de revisión">
              <ol className="flex flex-col gap-3 text-sm">
                {tarea.rondas.map((ronda) => (
                  <li key={ronda.id} className="flex flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-tinta">Ronda {ronda.numero}</span>
                      <Insignia tono={ronda.decision === 'APROBADA' ? 'exito' : 'peligro'}>
                        {ronda.decision === 'APROBADA' ? 'Aprobada' : 'Observada'}
                      </Insignia>
                    </span>
                    <span className="text-xs text-apagado">
                      {ronda.revisor.nombre} · {formatearFechaHora(ronda.fecha)}
                    </span>
                    {ronda.comentario === null ? null : (
                      <span className="whitespace-pre-line text-tinta">{ronda.comentario}</span>
                    )}
                  </li>
                ))}
              </ol>
            </Tarjeta>
          )}

          <Tarjeta titulo="Historial de estados">
            <ol className="flex flex-col gap-3 text-sm">
              {tarea.transiciones.map((transicion) => (
                <li key={transicion.id} className="flex flex-col">
                  <span className="font-medium text-tinta">
                    {transicion.desde === null
                      ? ETIQUETAS_ESTADO_TAREA[transicion.hacia]
                      : `${ETIQUETAS_ESTADO_TAREA[transicion.desde]} → ${ETIQUETAS_ESTADO_TAREA[transicion.hacia]}`}
                  </span>
                  <span className="text-xs text-apagado">
                    {transicion.usuario} · {formatearFechaHora(transicion.fecha)}
                    {transicion.comentario === null ? '' : ` · ${transicion.comentario}`}
                  </span>
                </li>
              ))}
            </ol>
          </Tarjeta>

          {tarea.acciones.cancelar ? (
            <Tarjeta titulo="Cancelar tarea" descripcion="Para trabajos que ya no deben hacerse.">
              <FormularioConfirmacion
                accion={cancelarTarea.bind(null, tarea.id)}
                etiquetaBoton="Cancelar tarea"
                textoPendiente="Cancelando…"
                variante="peligro"
                pedirMotivo
                ayudaMotivo="Justificación obligatoria; la verán los participantes."
                consecuencia="La tarea se cierra como Cancelada y no admite más avances. Su historial se conserva."
              />
            </Tarjeta>
          ) : null}
        </div>
      </div>
    </>
  );
}
