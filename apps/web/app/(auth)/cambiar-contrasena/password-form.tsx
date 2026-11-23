'use client';

import { LONGITUD_MINIMA_CONTRASENA } from '@sige/types';
import { Campo } from '@sige/ui/components';
import { type ReactNode, useActionState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL } from '@/lib/form-state';
import { cambiarContrasena } from './actions';

export function FormularioContrasena(): ReactNode {
  const [estado, accion] = useActionState(cambiarContrasena, ESTADO_INICIAL);

  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      <MensajeFormulario estado={estado} />
      <Campo
        id="actual"
        name="actual"
        type="password"
        etiqueta="Contraseña actual"
        autoComplete="current-password"
        required
        error={estado.errores.actual}
      />
      <Campo
        id="nueva"
        name="nueva"
        type="password"
        etiqueta="Nueva contraseña"
        ayuda={`Mínimo ${String(LONGITUD_MINIMA_CONTRASENA)} caracteres. Una frase de varias palabras es fácil de recordar y difícil de adivinar. No use su nombre, su correo ni el nombre de la empresa.`}
        autoComplete="new-password"
        minLength={LONGITUD_MINIMA_CONTRASENA}
        required
        error={estado.errores.nueva}
      />
      <Campo
        id="confirmacion"
        name="confirmacion"
        type="password"
        etiqueta="Confirme la nueva contraseña"
        autoComplete="new-password"
        required
        error={estado.errores.confirmacion}
      />
      <BotonEnvio textoPendiente="Guardando…" className="mt-2 w-full">
        Guardar contraseña
      </BotonEnvio>
    </form>
  );
}
