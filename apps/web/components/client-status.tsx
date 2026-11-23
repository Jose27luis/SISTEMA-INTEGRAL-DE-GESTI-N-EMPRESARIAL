import { type EstadoCliente, ETIQUETAS_ESTADO_CLIENTE } from '@sige/types';
import { Insignia, type TonoInsignia } from '@sige/ui/components';
import type { ReactNode } from 'react';

const TONOS: Record<EstadoCliente, TonoInsignia> = {
  ACTIVO: 'exito',
  SUSPENDIDO: 'aviso',
  INACTIVO: 'peligro',
};

export function EstadoClienteInsignia({ estado }: { estado: EstadoCliente }): ReactNode {
  return <Insignia tono={TONOS[estado]}>{ETIQUETAS_ESTADO_CLIENTE[estado]}</Insignia>;
}
