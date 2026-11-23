import { type EstadoTarea, ETIQUETAS_ESTADO_TAREA, ETIQUETAS_PRIORIDAD, type Prioridad } from '@sige/types';
import { cn } from '@sige/ui/cn';
import { Insignia, type TonoInsignia } from '@sige/ui/components';
import type { ReactNode } from 'react';

const TONOS_ESTADO: Record<EstadoTarea, TonoInsignia> = {
  PENDIENTE: 'neutro',
  EN_PROCESO: 'info',
  EN_REVISION: 'aviso',
  OBSERVADA: 'peligro',
  CORREGIDA: 'info',
  APROBADA: 'exito',
  FINALIZADA: 'exito',
  CANCELADA: 'neutro',
};

const TONOS_PRIORIDAD: Record<Prioridad, TonoInsignia> = {
  BAJA: 'neutro',
  MEDIA: 'info',
  ALTA: 'aviso',
  URGENTE: 'peligro',
};

export function EstadoTareaInsignia({ estado }: { estado: EstadoTarea }): ReactNode {
  return <Insignia tono={TONOS_ESTADO[estado]}>{ETIQUETAS_ESTADO_TAREA[estado]}</Insignia>;
}

export function PrioridadInsignia({ prioridad }: { prioridad: Prioridad }): ReactNode {
  return <Insignia tono={TONOS_PRIORIDAD[prioridad]}>{ETIQUETAS_PRIORIDAD[prioridad]}</Insignia>;
}

export function BarraAvance({ porcentaje, className }: { porcentaje: number; className?: string }): ReactNode {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        role="progressbar"
        aria-valuenow={porcentaje}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Avance"
        className="h-2 flex-1 overflow-hidden rounded-full bg-borde"
      >
        <div
          className={cn('h-full rounded-full', porcentaje === 100 ? 'bg-verde' : 'bg-marino-claro')}
          style={{ width: `${String(porcentaje)}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs font-semibold text-apagado tabular-nums">{porcentaje} %</span>
    </div>
  );
}
