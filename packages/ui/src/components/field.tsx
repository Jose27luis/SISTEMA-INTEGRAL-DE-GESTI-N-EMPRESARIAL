import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '../cn';

const CLASES_CONTROL =
  'w-full rounded-md border border-borde bg-superficie px-3 text-base text-tinta transition-colors focus:border-marino-claro focus:outline-2 focus:outline-offset-1 focus:outline-marino-claro/30 disabled:bg-fondo';

interface DescripcionCampo {
  id: string;
  etiqueta: string;
  ayuda?: string | undefined;
  error?: string | undefined;
}

function idsDescripcion({ id, ayuda, error }: DescripcionCampo): string | undefined {
  const ids = [
    ayuda === undefined ? null : `${id}-ayuda`,
    error === undefined ? null : `${id}-error`,
  ].filter((valor): valor is string => valor !== null);

  return ids.length === 0 ? undefined : ids.join(' ');
}

function Envoltura({
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

export type PropiedadesCampo = DescripcionCampo & InputHTMLAttributes<HTMLInputElement>;

export function Campo({ id, etiqueta, ayuda, error, className, ...resto }: PropiedadesCampo): ReactNode {
  return (
    <Envoltura id={id} etiqueta={etiqueta} ayuda={ayuda} error={error}>
      <input
        id={id}
        aria-invalid={error !== undefined}
        aria-describedby={idsDescripcion({ id, etiqueta, ayuda, error })}
        className={cn(CLASES_CONTROL, 'h-11', error !== undefined && 'border-rojo', className)}
        {...resto}
      />
    </Envoltura>
  );
}

export type PropiedadesAreaTexto = DescripcionCampo & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function AreaTexto({
  id,
  etiqueta,
  ayuda,
  error,
  className,
  rows = 3,
  ...resto
}: PropiedadesAreaTexto): ReactNode {
  return (
    <Envoltura id={id} etiqueta={etiqueta} ayuda={ayuda} error={error}>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error !== undefined}
        aria-describedby={idsDescripcion({ id, etiqueta, ayuda, error })}
        className={cn(CLASES_CONTROL, 'py-2', error !== undefined && 'border-rojo', className)}
        {...resto}
      />
    </Envoltura>
  );
}

export type PropiedadesSeleccion = DescripcionCampo & SelectHTMLAttributes<HTMLSelectElement>;

export function Seleccion({
  id,
  etiqueta,
  ayuda,
  error,
  className,
  children,
  ...resto
}: PropiedadesSeleccion): ReactNode {
  return (
    <Envoltura id={id} etiqueta={etiqueta} ayuda={ayuda} error={error}>
      <select
        id={id}
        aria-invalid={error !== undefined}
        aria-describedby={idsDescripcion({ id, etiqueta, ayuda, error })}
        className={cn(CLASES_CONTROL, 'h-11', error !== undefined && 'border-rojo', className)}
        {...resto}
      >
        {children}
      </select>
    </Envoltura>
  );
}

export interface PropiedadesCasilla extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  etiqueta: string;
  descripcion?: string | undefined;
}

export function Casilla({ id, etiqueta, descripcion, className, ...resto }: PropiedadesCasilla): ReactNode {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 accent-marino"
        aria-describedby={descripcion === undefined ? undefined : `${id}-descripcion`}
        {...resto}
      />
      <div className="flex flex-col">
        <label htmlFor={id} className="text-sm font-medium text-tinta">
          {etiqueta}
        </label>
        {descripcion === undefined ? null : (
          <p id={`${id}-descripcion`} className="text-sm text-apagado">
            {descripcion}
          </p>
        )}
      </div>
    </div>
  );
}
