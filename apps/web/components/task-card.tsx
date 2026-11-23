import type { TareaResumen } from '@sige/types';
import { cn } from '@sige/ui/cn';
import { CalendarClock } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatearFecha } from '@/lib/format';
import { BarraAvance, EstadoTareaInsignia, PrioridadInsignia } from './task-badges';

interface PropiedadesTarjetaTarea {
  tarea: TareaResumen;
  mostrarEstado?: boolean;
}

export function TarjetaTarea({ tarea, mostrarEstado = true }: PropiedadesTarjetaTarea): ReactNode {
  return (
    <Link
      href={`/tareas/${tarea.id}`}
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-borde bg-superficie p-4 transition-colors hover:border-marino-claro',
        tarea.atrasada && 'border-l-4 border-l-rojo',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-apagado">{tarea.codigo}</p>
          <p className="font-semibold break-words text-marino">{tarea.titulo}</p>
          <p className="truncate text-xs text-apagado">
            {tarea.cliente?.nombre ?? 'Interna'} · {tarea.responsable.nombre}
          </p>
        </div>
        <PrioridadInsignia prioridad={tarea.prioridad} />
      </div>
      <BarraAvance porcentaje={tarea.porcentajeAvance} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium',
            tarea.atrasada ? 'text-rojo' : 'text-apagado',
          )}
        >
          <CalendarClock aria-hidden="true" className="size-4" />
          {tarea.atrasada ? 'Venció el ' : 'Vence el '}
          {formatearFecha(tarea.fechaLimite)}
        </span>
        {mostrarEstado ? <EstadoTareaInsignia estado={tarea.estado} /> : null}
      </div>
    </Link>
  );
}
