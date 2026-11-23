import type { Perfil } from '@sige/types';
import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { cerrarSesion } from '@/app/(panel)/actions';

interface PropiedadesPanelUsuario {
  perfil: Perfil;
}

export function PanelUsuario({ perfil }: PropiedadesPanelUsuario): ReactNode {
  return (
    <div className="flex flex-col gap-3 border-t border-white/10 p-4">
      <div className="flex flex-col">
        <span className="truncate text-sm font-semibold text-white">{perfil.usuario.nombre}</span>
        <span className="truncate text-xs text-white/60">
          {perfil.roles.map(({ nombre }) => nombre).join(' · ')}
        </span>
      </div>
      <form action={cerrarSesion}>
        <button
          type="submit"
          className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
        >
          <LogOut aria-hidden="true" className="size-4" />
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
