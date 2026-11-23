'use client';

import { type ReactNode, useActionState } from 'react';
import { BotonAcceso } from '@/components/auth/access-button';
import { CampoContrasenaAcceso } from '@/components/auth/access-password-field';
import { MensajeAnimado } from '@/components/auth/animated-message';
import { ESTADO_INICIAL } from '@/lib/form-state';
import { cambiarContrasena } from './actions';

export function FormularioContrasena(): ReactNode {
  const [estado, accion] = useActionState(cambiarContrasena, ESTADO_INICIAL);

  return (
    <form action={accion} className="flex flex-col gap-5" noValidate>
      <MensajeAnimado estado={estado} />
      <CampoContrasenaAcceso
        id="actual"
        name="actual"
        etiqueta="Contraseña actual"
        autoComplete="current-password"
        error={estado.errores.actual}
      />
      <CampoContrasenaAcceso
        id="nueva"
        name="nueva"
        etiqueta="Nueva contraseña"
        autoComplete="new-password"
        error={estado.errores.nueva}
      />
      <CampoContrasenaAcceso
        id="confirmacion"
        name="confirmacion"
        etiqueta="Repita la nueva contraseña"
        autoComplete="new-password"
        error={estado.errores.confirmacion}
      />
      <BotonAcceso textoPendiente="Guardando…">Guardar contraseña</BotonAcceso>
    </form>
  );
}
