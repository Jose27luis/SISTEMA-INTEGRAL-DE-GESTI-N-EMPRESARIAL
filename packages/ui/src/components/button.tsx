import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'sutil';

const CLASES_VARIANTE: Record<VarianteBoton, string> = {
  primario: 'bg-marino text-white hover:bg-marino-medio focus-visible:outline-dorado',
  secundario:
    'border border-borde bg-superficie text-marino hover:border-marino-claro focus-visible:outline-marino-claro',
  peligro: 'bg-rojo text-white hover:bg-rojo/90 focus-visible:outline-rojo',
  sutil: 'text-marino-claro hover:bg-fondo focus-visible:outline-marino-claro',
};

export interface PropiedadesBoton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton;
}

export function Boton({
  variante = 'primario',
  className,
  type = 'button',
  children,
  ...resto
}: PropiedadesBoton): ReactNode {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
        CLASES_VARIANTE[variante],
        className,
      )}
      {...resto}
    >
      {children}
    </button>
  );
}
