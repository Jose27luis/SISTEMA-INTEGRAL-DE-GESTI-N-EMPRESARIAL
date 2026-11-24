import { type EstadoCobranza, ETIQUETAS_ESTADO_COBRANZA } from '@sige/types';
import { Insignia } from '@sige/ui/components';
import type { ReactNode } from 'react';

const TONOS: Record<EstadoCobranza, 'exito' | 'aviso' | 'info' | 'neutro'> = {
  PAGADO: 'exito',
  PARCIAL: 'info',
  PENDIENTE: 'aviso',
  ANULADO: 'neutro',
};

export function EstadoCobro({ estado, diasVencido }: { estado: EstadoCobranza; diasVencido: number }): ReactNode {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Insignia tono={TONOS[estado]}>{ETIQUETAS_ESTADO_COBRANZA[estado]}</Insignia>
      {diasVencido > 0 ? <Insignia tono="peligro">{`Vencido ${String(diasVencido)} d`}</Insignia> : null}
    </span>
  );
}
