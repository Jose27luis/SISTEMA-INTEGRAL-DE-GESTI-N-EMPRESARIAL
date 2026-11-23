'use client';

import { AreaTexto, Casilla } from '@sige/ui/components';
import { type ReactNode, useActionState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { CampoContrasena } from '@/components/password-field';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

interface PropiedadesFormularioRestablecer {
  accion: (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
}

export function FormularioRestablecerContrasena({ accion }: PropiedadesFormularioRestablecer): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={accionFormulario} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <CampoContrasena
        id="restablecer-contrasena"
        name="contrasena"
        etiqueta="Nueva contraseña"
        autoComplete="new-password"
        error={estado.errores.contrasena}
      />
      <CampoContrasena
        id="restablecer-repeticion"
        name="repeticion"
        etiqueta="Repita la contraseña"
        autoComplete="new-password"
        error={estado.errores.repeticion}
      />
      <AreaTexto
        id="restablecer-motivo"
        name="motivo"
        etiqueta="Motivo"
        ayuda="Quedará registrado en la auditoría. Por ejemplo: el usuario olvidó su contraseña."
        minLength={5}
        maxLength={500}
        required
        defaultValue={estado.exito ? '' : estado.valores.motivo}
        error={estado.errores.motivo}
      />
      <Casilla
        id="restablecer-confirmacion"
        name="confirmacion"
        value="si"
        required
        etiqueta="Confirmo la acción"
        descripcion="Su contraseña actual deja de funcionar y se cierran sus sesiones abiertas."
      />
      {estado.errores.confirmacion === undefined ? null : (
        <p className="text-sm font-medium text-rojo">{estado.errores.confirmacion}</p>
      )}
      <BotonEnvio variante="secundario" textoPendiente="Guardando…" className="self-start">
        Asignar contraseña
      </BotonEnvio>
    </form>
  );
}
