import type { ReactNode } from 'react';

interface PropiedadesEncabezado {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
  antetitulo?: ReactNode;
}

export function EncabezadoPagina({ titulo, descripcion, acciones, antetitulo }: PropiedadesEncabezado): ReactNode {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        {antetitulo}
        <h1 className="text-2xl font-bold text-marino sm:text-3xl">{titulo}</h1>
        {descripcion === undefined ? null : <p className="text-sm text-apagado">{descripcion}</p>}
      </div>
      {acciones}
    </header>
  );
}
