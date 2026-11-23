import { Alerta } from '@sige/ui/components';
import type { ReactNode } from 'react';
import type { EstadoFormulario } from '@/lib/form-state';

interface PropiedadesMensajeFormulario {
  estado: EstadoFormulario;
}

export function MensajeFormulario({ estado }: PropiedadesMensajeFormulario): ReactNode {
  if (estado.mensaje === null) {
    return null;
  }

  return <Alerta tono={estado.exito ? 'exito' : 'error'}>{estado.mensaje}</Alerta>;
}
