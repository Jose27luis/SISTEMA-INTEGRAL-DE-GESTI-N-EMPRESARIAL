import { Search } from 'lucide-react';
import type { ReactNode } from 'react';

export function BuscadorGeneral({ consulta = '' }: { consulta?: string }): ReactNode {
  return (
    <form action="/buscar" method="get" role="search" className="relative w-full max-w-md">
      <label htmlFor="buscador-general" className="sr-only">
        Buscar clientes, tareas, documentos y proyectos
      </label>
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-apagado" />
      <input
        id="buscador-general"
        name="q"
        type="search"
        minLength={2}
        maxLength={100}
        defaultValue={consulta}
        aria-label="Buscar clientes por nombre, RUC o DNI, tareas, documentos y proyectos"
        className="h-11 w-full rounded-md border border-borde bg-superficie pr-3 pl-9 text-sm text-tinta focus:border-marino-claro focus:outline-none focus-visible:ring-2 focus-visible:ring-marino-claro/40"
      />
    </form>
  );
}
