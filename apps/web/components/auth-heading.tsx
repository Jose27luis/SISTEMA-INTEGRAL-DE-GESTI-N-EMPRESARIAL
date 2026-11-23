import type { ReactNode } from 'react';
import { Aparecer } from './auth/appear';

interface PropiedadesEncabezadoAcceso {
  titulo: string;
  descripcion?: string;
  icono?: ReactNode;
}

export function EncabezadoAcceso({ titulo, descripcion, icono }: PropiedadesEncabezadoAcceso): ReactNode {
  return (
    <Aparecer className="flex flex-col items-center gap-2 text-center">
      {icono === undefined ? null : (
        <span className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-marino/8 text-marino">
          {icono}
        </span>
      )}
      <h1 className="font-display text-3xl font-semibold text-marino">{titulo}</h1>
      {descripcion === undefined ? null : <p className="text-base text-apagado">{descripcion}</p>}
    </Aparecer>
  );
}
