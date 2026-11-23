'use client';

import { Campo } from '@sige/ui/components';
import { type ReactNode, useActionState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL } from '@/lib/form-state';
import { iniciarSesion } from './actions';

export function FormularioIngreso(): ReactNode {
  const [estado, accion] = useActionState(iniciarSesion, ESTADO_INICIAL);

  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      <MensajeFormulario estado={estado} />
      <Campo
        id="correo"
        name="correo"
        type="email"
        etiqueta="Correo electrónico"
        autoComplete="username"
        required
        defaultValue={estado.valores.correo}
        error={estado.errores.correo}
      />
      <Campo
        id="contrasena"
        name="contrasena"
        type="password"
        etiqueta="Contraseña"
        autoComplete="current-password"
        required
        error={estado.errores.contrasena}
      />
      <BotonEnvio textoPendiente="Ingresando…" className="mt-2 w-full">
        Ingresar
      </BotonEnvio>
    </form>
  );
}
