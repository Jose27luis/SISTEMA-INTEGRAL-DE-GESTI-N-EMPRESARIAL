import { type EstadoTarea, ETIQUETAS_ESTADO_TAREA, type ProyectoDetalle, type TareaProyecto } from '@sige/types';
import { cn } from '@sige/ui/cn';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatearFecha } from '@/lib/format';

const MS_POR_DIA = 86_400_000;

function dias(fecha: string): number {
  return Math.round(Date.parse(`${fecha}T00:00:00Z`) / MS_POR_DIA);
}

function Barra({
  desde,
  hasta,
  inicio,
  total,
  clase,
  titulo,
}: {
  desde: string;
  hasta: string;
  inicio: number;
  total: number;
  clase: string;
  titulo: string;
}): ReactNode {
  const izquierda = ((dias(desde) - inicio) / total) * 100;
  const ancho = Math.max(((dias(hasta) - dias(desde) + 1) / total) * 100, 1.5);

  return (
    <span
      title={titulo}
      className={cn('absolute top-1/2 h-3 -translate-y-1/2 rounded-sm', clase)}
      style={{ left: `${String(izquierda)}%`, width: `${String(Math.min(ancho, 100 - izquierda))}%` }}
    />
  );
}

export function Cronograma({ proyecto, hoy }: { proyecto: ProyectoDetalle; hoy: string }): ReactNode {
  const fechas = [
    proyecto.fechaInicio,
    proyecto.fechaEntrega,
    ...proyecto.etapas.flatMap(({ inicio, fin }) => [inicio, fin]),
    ...proyecto.tareasDetalle.flatMap(({ fechaInicio, fechaLimite }) => (fechaInicio === null ? [fechaLimite] : [fechaInicio, fechaLimite])),
  ].sort();
  const primera = fechas[0] ?? proyecto.fechaInicio;
  const ultima = fechas.at(-1) ?? proyecto.fechaEntrega;
  const inicio = dias(primera);
  const total = Math.max(dias(ultima) - inicio + 1, 1);
  const posicionHoy = ((dias(hoy) - inicio) / total) * 100;

  if (proyecto.etapas.length === 0) {
    return <p className="text-sm text-apagado">Agregue etapas para ver el cronograma.</p>;
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="min-w-[44rem]">
        <div className="mb-2 grid grid-cols-[16rem_1fr] text-xs text-apagado">
          <span />
          <span className="flex justify-between">
            <span>{formatearFecha(primera)}</span>
            <span>{formatearFecha(ultima)}</span>
          </span>
        </div>
        <ul className="flex flex-col">
          {proyecto.etapas.map((etapa) => (
            <li key={etapa.id}>
              <div className="grid grid-cols-[16rem_1fr] items-center border-t border-borde py-1.5">
                <span className="truncate pr-3 text-sm font-semibold text-marino">
                  {etapa.orden}. {etapa.nombre}
                </span>
                <span className="relative h-6">
                  {posicionHoy >= 0 && posicionHoy <= 100 ? (
                    <span className="absolute inset-y-0 w-px bg-rojo" style={{ left: `${String(posicionHoy)}%` }} aria-hidden="true" />
                  ) : null}
                  <Barra
                    desde={etapa.inicio}
                    hasta={etapa.fin}
                    inicio={inicio}
                    total={total}
                    clase={etapa.estado === 'COMPLETADA' ? 'bg-verde' : 'bg-marino'}
                    titulo={`${etapa.nombre}: ${formatearFecha(etapa.inicio)} a ${formatearFecha(etapa.fin)} · ${String(etapa.avance)} %`}
                  />
                </span>
              </div>
              {proyecto.tareasDetalle
                .filter(({ etapaId }) => etapaId === etapa.id)
                .map((tarea) => (
                  <div key={tarea.id} className="grid grid-cols-[16rem_1fr] items-center py-1">
                    <Link href={`/tareas/${tarea.id}`} className="truncate pr-3 pl-4 text-xs text-tinta hover:underline">
                      {tarea.codigo} · {tarea.titulo}
                    </Link>
                    <span className="relative h-5">
                      <Barra
                        desde={tarea.fechaInicio ?? etapa.inicio}
                        hasta={tarea.fechaLimite}
                        inicio={inicio}
                        total={total}
                        clase={
                          tarea.estado === 'APROBADA' || tarea.estado === 'FINALIZADA'
                            ? 'bg-verde/70'
                            : tarea.atrasada
                              ? 'bg-rojo/70'
                              : tarea.estado === 'CANCELADA'
                                ? 'bg-borde'
                                : 'bg-dorado'
                        }
                        titulo={`${tarea.titulo}: vence ${formatearFecha(tarea.fechaLimite)} · ${ETIQUETAS_ESTADO_TAREA[tarea.estado]}`}
                      />
                    </span>
                  </div>
                ))}
            </li>
          ))}
        </ul>
        <p className="mt-3 flex flex-wrap gap-4 text-xs text-apagado">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-4 rounded-sm bg-marino" /> Etapa
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-4 rounded-sm bg-dorado" /> Tarea abierta
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-4 rounded-sm bg-verde/70" /> Cerrada
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-4 rounded-sm bg-rojo/70" /> Atrasada
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-px bg-rojo" /> Hoy
          </span>
        </p>
      </div>
    </div>
  );
}

const COLUMNAS: { titulo: string; estados: readonly EstadoTarea[] }[] = [
  { titulo: 'Pendientes', estados: ['PENDIENTE'] },
  { titulo: 'En proceso', estados: ['EN_PROCESO', 'OBSERVADA', 'CORREGIDA'] },
  { titulo: 'En revisión', estados: ['EN_REVISION'] },
  { titulo: 'Terminadas', estados: ['APROBADA', 'FINALIZADA'] },
];

function TarjetaKanban({ tarea, etapa }: { tarea: TareaProyecto; etapa: string }): ReactNode {
  return (
    <li className={cn('rounded-md border bg-superficie p-3 text-sm', tarea.atrasada ? 'border-rojo/60' : 'border-borde')}>
      <Link href={`/tareas/${tarea.id}`} className="font-semibold text-marino hover:underline">
        {tarea.titulo}
      </Link>
      <p className="text-xs text-apagado">
        {tarea.codigo} · {etapa}
      </p>
      <p className="text-xs text-apagado">
        {tarea.responsable.nombre} · vence {formatearFecha(tarea.fechaLimite)}
        {tarea.estado === 'OBSERVADA' ? ' · observada' : ''}
      </p>
      <p className={cn('text-xs tabular-nums', tarea.atrasada ? 'font-semibold text-rojo' : 'text-tinta')}>
        {tarea.atrasada ? 'Atrasada · ' : ''}
        {tarea.porcentajeAvance} %
      </p>
    </li>
  );
}

export function Tablero({ proyecto }: { proyecto: ProyectoDetalle }): ReactNode {
  const etapas = new Map(proyecto.etapas.map(({ id, nombre }) => [id, nombre]));
  const canceladas = proyecto.tareasDetalle.filter(({ estado }) => estado === 'CANCELADA').length;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNAS.map((columna) => {
          const tareas = proyecto.tareasDetalle.filter(({ estado }) => columna.estados.includes(estado));

          return (
            <section key={columna.titulo} aria-label={columna.titulo} className="rounded-lg bg-fondo p-3">
              <h3 className="mb-3 flex items-center justify-between text-sm font-semibold text-marino">
                {columna.titulo}
                <span className="text-xs text-apagado tabular-nums">{tareas.length}</span>
              </h3>
              {tareas.length === 0 ? (
                <p className="text-xs text-apagado">Sin tareas.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {tareas.map((tarea) => (
                    <TarjetaKanban key={tarea.id} tarea={tarea} etapa={etapas.get(tarea.etapaId) ?? ''} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <p className="text-xs text-apagado">
        El estado de cada tarea cambia desde su detalle, con avances y revisión.
        {canceladas > 0 ? ` ${String(canceladas)} ${canceladas === 1 ? 'tarea cancelada no se muestra' : 'tareas canceladas no se muestran'}.` : ''}
      </p>
    </div>
  );
}
