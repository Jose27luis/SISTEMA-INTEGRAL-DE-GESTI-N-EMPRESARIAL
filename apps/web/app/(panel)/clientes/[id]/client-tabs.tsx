'use client';

import { cn } from '@sige/ui/cn';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

interface PropiedadesPestanas {
  clienteId: string;
  totalContactos: number;
  totalEquipo: number;
  verObligaciones: boolean;
}

export function PestanasCliente({
  clienteId,
  totalContactos,
  totalEquipo,
  verObligaciones,
}: PropiedadesPestanas): ReactNode {
  const ruta = usePathname();
  const base = `/clientes/${clienteId}`;
  const pestanas = [
    { href: base, etiqueta: 'General' },
    { href: `${base}/contactos`, etiqueta: `Contactos (${String(totalContactos)})` },
    { href: `${base}/equipo`, etiqueta: `Equipo (${String(totalEquipo)})` },
    ...(verObligaciones ? [{ href: `${base}/obligaciones`, etiqueta: 'Obligaciones' }] : []),
    { href: `${base}/historial`, etiqueta: 'Historial' },
  ];

  return (
    <nav aria-label="Secciones del expediente" className="mb-6 overflow-x-auto border-b border-borde">
      <ul className="flex min-w-max gap-1">
        {pestanas.map((pestana) => {
          const activa = ruta === pestana.href;

          return (
            <li key={pestana.href}>
              <Link
                href={pestana.href}
                aria-current={activa ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-semibold transition-colors',
                  activa
                    ? 'border-dorado text-marino'
                    : 'border-transparent text-apagado hover:border-borde hover:text-marino',
                )}
              >
                {pestana.etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
