'use client';

import { Mail } from 'lucide-react';
import { type ReactNode, useActionState } from 'react';
import { BotonAcceso } from '@/components/auth/access-button';
import { CampoAcceso } from '@/components/auth/access-field';
import { CampoContrasenaAcceso } from '@/components/auth/access-password-field';
import { MensajeAnimado } from '@/components/auth/animated-message';
import { ESTADO_INICIAL } from '@/lib/form-state';
import { iniciarSesion } from './actions';

export function FormularioIngreso(): ReactNode {
  const [estado, accion] = useActionState(iniciarSesion, ESTADO_INICIAL);

  return (
    <form action={accion} className="flex flex-col gap-5" noValidate>
      <MensajeAnimado estado={estado} />
      <CampoAcceso
        id="correo"
        name="correo"
        type="email"
        etiqueta="Correo electrónico"
        icono={Mail}
        autoComplete="username"
        inputMode="email"
        required
        autoFocus
        defaultValue={estado.valores.correo}
        error={estado.errores.correo}
      />
      <CampoContrasenaAcceso
        id="contrasena"
        name="contrasena"
        etiqueta="Contraseña"
        autoComplete="current-password"
        error={estado.errores.contrasena}
      />
      <BotonAcceso textoPendiente="Ingresando…">Ingresar</BotonAcceso>
    </form>
  );
}
