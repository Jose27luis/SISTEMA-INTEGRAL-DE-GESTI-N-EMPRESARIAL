'use client';

import { type ReactNode, useActionState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

interface PropiedadesBotonIniciar {
  accion: () => Promise<EstadoFormulario>;
}

export function BotonIniciar({ accion }: PropiedadesBotonIniciar): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={accionFormulario} className="flex flex-col items-end gap-2">
      {estado.exito ? null : <MensajeFormulario estado={estado} />}
      <BotonEnvio textoPendiente="Iniciando…">Iniciar tarea</BotonEnvio>
    </form>
  );
}
