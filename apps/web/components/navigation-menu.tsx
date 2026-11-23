'use client';

import { cn } from '@sige/ui/cn';
import {
  Bell,
  Building2,
  CircleUserRound,
  ClipboardCheck,
  House,
  IdCard,
  ListChecks,
  ListTree,
  type LucideIcon,
  ScrollText,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { GrupoNavegacion, IconoNavegacion } from '@/lib/navigation';

const ICONOS: Record<IconoNavegacion, LucideIcon> = {
  inicio: House,
  cuenta: CircleUserRound,
  'mi-trabajo': ClipboardCheck,
  tareas: ListChecks,
  notificaciones: Bell,
  clientes: Building2,
  personal: IdCard,
  usuarios: Users,
  roles: ShieldCheck,
  catalogos: ListTree,
  auditoria: ScrollText,
};

interface PropiedadesMenu {
  grupos: GrupoNavegacion[];
}

export function MenuNavegacion({ grupos }: PropiedadesMenu): ReactNode {
  const rutaActual = usePathname();

  return (
    <nav aria-label="Navegación principal" className="flex flex-col gap-6 px-3 py-4">
      {grupos.map((grupo) => (
        <div key={grupo.titulo} className="flex flex-col gap-1">
          <p className="px-3 text-xs font-semibold tracking-wider text-white/50 uppercase">{grupo.titulo}</p>
          {grupo.elementos.map((elemento) => {
            const Icono = ICONOS[elemento.icono];
            const activo = rutaActual === elemento.ruta || rutaActual.startsWith(`${elemento.ruta}/`);

            return (
              <Link
                key={elemento.ruta}
                href={elemento.ruta}
                aria-current={activo ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white',
                  activo && 'bg-white/10 text-white shadow-[inset_3px_0_0_var(--color-dorado)]',
                )}
              >
                <Icono aria-hidden="true" className="size-5 shrink-0" />
                {elemento.etiqueta}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
