import type { ReactNode } from 'react';

export const CLASES_CONTROL =
  'w-full rounded-md border border-borde bg-superficie px-3 text-base text-tinta transition-colors focus:border-marino-claro focus:outline-2 focus:outline-offset-1 focus:outline-marino-claro/30 disabled:bg-fondo';

export interface DescripcionCampo {
  id: string;
  etiqueta: string;
  ayuda?: string | undefined;
  error?: string | undefined;
}

export function idsDescripcion({ id, ayuda, error }: DescripcionCampo): string | undefined {
  const ids = [
    ayuda === undefined ? null : `${id}-ayuda`,
    error === undefined ? null : `${id}-error`,
  ].filter((valor): valor is string => valor !== null);

  return ids.length === 0 ? undefined : ids.join(' ');
}

export function Envoltura({
  id,
  etiqueta,
  ayuda,
  error,
  children,
}: DescripcionCampo & { children: ReactNode }): ReactNode {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-tinta">
        {etiqueta}
      </label>
      {children}
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
