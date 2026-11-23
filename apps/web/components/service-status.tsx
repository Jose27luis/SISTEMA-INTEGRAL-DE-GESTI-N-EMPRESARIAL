import type { ReactNode } from 'react';
import { cn } from '@sige/ui/cn';

interface PropiedadesEstadoServicio {
  nombre: string;
  disponible: boolean;
}

export function EstadoServicio({ nombre, disponible }: PropiedadesEstadoServicio): ReactNode {
  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border border-borde bg-superficie px-4 py-3">
      <span className="font-medium">{nombre}</span>
      <span
        className={cn(
          'inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold',
          disponible ? 'bg-verde-suave text-verde' : 'bg-rojo-suave text-rojo',
        )}
      >
        <span
          aria-hidden="true"
          className={cn('size-2 rounded-full', disponible ? 'bg-verde' : 'bg-rojo')}
        />
        {disponible ? 'Disponible' : 'No disponible'}
      </span>
    </li>
  );
}
