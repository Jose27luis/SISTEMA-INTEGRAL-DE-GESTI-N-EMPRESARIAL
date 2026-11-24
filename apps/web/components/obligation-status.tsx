import { type EstadoObligacion, ETIQUETAS_ESTADO_OBLIGACION } from '@sige/types';
import { Insignia, type TonoInsignia } from '@sige/ui/components';
import type { ReactNode } from 'react';

export const TONOS_ESTADO_OBLIGACION: Record<EstadoObligacion, TonoInsignia> = {
  PENDIENTE: 'neutro',
  EN_PROCESO: 'info',
  PRESENTADA: 'aviso',
  OBSERVADA: 'peligro',
  CUMPLIDA: 'exito',
  ANULADA: 'neutro',
};

export function EstadoObligacionInsignia({ estado, vencida }: { estado: EstadoObligacion; vencida: boolean }): ReactNode {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Insignia tono={TONOS_ESTADO_OBLIGACION[estado]}>{ETIQUETAS_ESTADO_OBLIGACION[estado]}</Insignia>
      {vencida ? <Insignia tono="peligro">Vencida</Insignia> : null}
    </span>
  );
}
