import { type EstadoProyecto, ETIQUETAS_ESTADO_PROYECTO } from '@sige/types';
import { Insignia } from '@sige/ui/components';
import type { ReactNode } from 'react';

const TONOS: Record<EstadoProyecto, 'exito' | 'aviso' | 'info' | 'neutro' | 'peligro'> = {
  PLANIFICADO: 'neutro',
  EN_CURSO: 'info',
  EN_PAUSA: 'aviso',
  FINALIZADO: 'exito',
  CANCELADO: 'neutro',
};

export function EstadoProyectoInsignia({
  estado,
  atrasado = false,
  conDificultades = false,
}: {
  estado: EstadoProyecto;
  atrasado?: boolean;
  conDificultades?: boolean;
}): ReactNode {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Insignia tono={TONOS[estado]}>{ETIQUETAS_ESTADO_PROYECTO[estado]}</Insignia>
      {atrasado ? <Insignia tono="peligro">Atrasado</Insignia> : null}
      {conDificultades ? <Insignia tono="peligro">Con dificultades</Insignia> : null}
    </span>
  );
}

export function BarraAvance({ avance }: { avance: number }): ReactNode {
  return (
    <span className="flex items-center gap-2">
      <span
        className="h-2 w-24 overflow-hidden rounded-full bg-borde"
        role="progressbar"
        aria-valuenow={avance}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Avance"
      >
        <span className="block h-full rounded-full bg-marino" style={{ width: `${String(avance)}%` }} />
      </span>
      <span className="text-xs text-apagado tabular-nums">{avance} %</span>
    </span>
  );
}
