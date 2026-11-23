'use client';

import { KeyRound } from 'lucide-react';
import { type ReactNode, useActionState } from 'react';
import { BotonAcceso } from '@/components/auth/access-button';
import { CampoAcceso } from '@/components/auth/access-field';
import { MensajeAnimado } from '@/components/auth/animated-message';
import { ESTADO_INICIAL } from '@/lib/form-state';
import { verificarCodigo } from '../actions';

export function FormularioVerificacion(): ReactNode {
  const [estado, accion] = useActionState(verificarCodigo, ESTADO_INICIAL);

  return (
    <form action={accion} className="flex flex-col gap-5" noValidate>
      <MensajeAnimado estado={estado} />
      <CampoAcceso
        id="codigo"
        name="codigo"
        etiqueta="Código de verificación"
        icono={KeyRound}
        ayuda="Si no tiene su teléfono, use uno de sus códigos de recuperación (XXXX-XXXX)."
        autoComplete="one-time-code"
        inputMode="text"
        maxLength={9}
        required
        autoFocus
        className="font-mono text-xl tracking-[0.35em]"
        error={estado.errores.codigo}
      />
      <BotonAcceso textoPendiente="Verificando…">Verificar e ingresar</BotonAcceso>
    </form>
  );
}
