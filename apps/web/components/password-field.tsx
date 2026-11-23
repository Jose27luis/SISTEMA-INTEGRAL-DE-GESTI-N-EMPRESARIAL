'use client';

import { cn } from '@sige/ui/cn';
import { Eye, EyeOff } from 'lucide-react';
import { type ReactNode, useState } from 'react';

interface PropiedadesCampoContrasena {
  id: string;
  name: string;
  etiqueta: string;
  autoComplete: 'current-password' | 'new-password';
  ayuda?: string | undefined;
  error?: string | undefined;
  autoFocus?: boolean;
}

export function CampoContrasena({
  id,
  name,
  etiqueta,
  autoComplete,
  ayuda,
  error,
  autoFocus = false,
}: PropiedadesCampoContrasena): ReactNode {
  const [visible, setVisible] = useState(false);
  const descripcion = [ayuda === undefined ? null : `${id}-ayuda`, error === undefined ? null : `${id}-error`]
    .filter((valor): valor is string => valor !== null)
    .join(' ');

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-tinta">
        {etiqueta}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          aria-invalid={error !== undefined}
          aria-describedby={descripcion === '' ? undefined : descripcion}
          className={cn(
            'h-12 w-full rounded-lg border border-borde bg-superficie pr-12 pl-4 text-base text-tinta transition-colors focus:border-marino-claro focus:outline-3 focus:outline-offset-0 focus:outline-marino-claro/20',
            error !== undefined && 'border-rojo',
          )}
        />
        <button
          type="button"
          onClick={() => {
            setVisible((actual) => !actual);
          }}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-apagado hover:text-marino focus-visible:outline-2 focus-visible:outline-marino-claro"
        >
          {visible ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
        </button>
      </div>
      {ayuda === undefined ? null : (
        <p id={`${id}-ayuda`} className="text-sm text-apagado">
          {ayuda}
        </p>
      )}
      {error === undefined ? null : (
        <p id={`${id}-error`} className="text-sm font-medium text-rojo">
          {error}
        </p>
      )}
    </div>
  );
}
