'use client';

import { Campo } from '@sige/ui/components';
import { type ReactNode, useActionState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL } from '@/lib/form-state';
import { verificarCodigo } from '../actions';

export function FormularioVerificacion(): ReactNode {
  const [estado, accion] = useActionState(verificarCodigo, ESTADO_INICIAL);

  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      <MensajeFormulario estado={estado} />
      <Campo
        id="codigo"
        name="codigo"
        etiqueta="Código de verificación"
        ayuda="Los 6 dígitos de su aplicación autenticadora o uno de sus códigos de recuperación."
        autoComplete="one-time-code"
        inputMode="text"
        maxLength={9}
        required
        autoFocus
        error={estado.errores.codigo}
      />
      <BotonEnvio textoPendiente="Verificando…" className="mt-2 w-full">
        Verificar
      </BotonEnvio>
    </form>
  );
}
