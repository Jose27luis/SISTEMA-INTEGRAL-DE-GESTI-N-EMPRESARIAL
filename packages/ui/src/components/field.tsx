import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { cn } from '../cn';
import { CampoFecha, CampoMes } from './date-picker';
import { CLASES_CONTROL, type DescripcionCampo, Envoltura, idsDescripcion } from './field-base';
import { CampoHora } from './time-picker';

export type PropiedadesCampo = DescripcionCampo & InputHTMLAttributes<HTMLInputElement>;

export function Campo({ id, etiqueta, ayuda, error, className, ...resto }: PropiedadesCampo): ReactNode {
  const { type: tipo, ...sinTipo } = resto;
  const propiedades = { id, etiqueta, ayuda, error, className, ...sinTipo };

  if (tipo === 'date') {
    return <CampoFecha {...propiedades} />;
  }

  if (tipo === 'month') {
    return <CampoMes {...propiedades} />;
  }

  if (tipo === 'time') {
    return <CampoHora {...propiedades} />;
  }

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
