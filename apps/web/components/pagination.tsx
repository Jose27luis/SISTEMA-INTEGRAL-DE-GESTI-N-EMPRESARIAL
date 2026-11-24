import Link from 'next/link';
import type { ReactNode } from 'react';

interface PropiedadesPaginacion {
  ruta: string;
  consulta: URLSearchParams;
  pagina: number;
  total: number;
  porPagina: number;
}

export function Paginacion({ ruta, consulta, pagina, total, porPagina }: PropiedadesPaginacion): ReactNode {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  if (totalPaginas <= 1) {
    return null;
  }

  const enlace = (numero: number): string => {
    const destino = new URLSearchParams(consulta);
    destino.set('pagina', String(numero));
    return `${ruta}?${destino.toString()}`;
  };

  return (
    <nav aria-label="Páginas" className="mt-4 flex items-center justify-between text-sm">
      {pagina > 1 ? (
        <Link href={enlace(pagina - 1)} className="font-semibold text-marino-claro hover:underline">
          ← Anterior
        </Link>
      ) : (
        <span />
      )}
      <span className="text-apagado">
        Página {pagina} de {totalPaginas}
      </span>
      {pagina < totalPaginas ? (
        <Link href={enlace(pagina + 1)} className="font-semibold text-marino-claro hover:underline">
          Siguiente →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
