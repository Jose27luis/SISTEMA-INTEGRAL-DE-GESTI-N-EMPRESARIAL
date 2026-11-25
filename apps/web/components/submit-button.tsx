'use client';

import { Boton, type VarianteBoton } from '@sige/ui/components';
import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

interface PropiedadesBotonEnvio {
  children: ReactNode;
  textoPendiente: string;
  variante?: VarianteBoton;
  className?: string;
  disabled?: boolean;
}

export function BotonEnvio({
  children,
  textoPendiente,
  variante = 'primario',
  className,
  disabled = false,
}: PropiedadesBotonEnvio): ReactNode {
  const { pending } = useFormStatus();

  return (
    <Boton type="submit" variante={variante} disabled={pending || disabled} aria-busy={pending} className={className}>
      {pending ? textoPendiente : children}
    </Boton>
  );
}
