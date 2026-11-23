import { Menu } from 'lucide-react';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Marca } from '@/components/brand';
import { MenuNavegacion } from '@/components/navigation-menu';
import { PanelUsuario } from '@/components/user-panel';
import { navegacionPermitida } from '@/lib/navigation';
import { obtenerPerfil, rutaPendiente } from '@/lib/profile';

interface PropiedadesLayoutPanel {
  children: ReactNode;
}

export default async function LayoutPanel({ children }: PropiedadesLayoutPanel): Promise<ReactNode> {
  const perfil = await obtenerPerfil();
  const pendiente = rutaPendiente(perfil);

  if (pendiente !== null) {
    redirect(pendiente);
  }

  const grupos = navegacionPermitida(perfil.permisos);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col bg-marino md:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <Marca claro />
        </div>
        <div className="flex-1 overflow-y-auto">
          <MenuNavegacion grupos={grupos} />
        </div>
        <PanelUsuario perfil={perfil} />
      </aside>

      <div className="flex min-w-0 flex-col">
        <details className="group sticky top-0 z-10 bg-marino md:hidden">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4">
            <Marca claro />
            <span className="inline-flex items-center gap-2 text-sm font-medium text-white">
              <Menu aria-hidden="true" className="size-5" />
              Menú
            </span>
          </summary>
          <div className="border-t border-white/10">
            <MenuNavegacion grupos={grupos} />
            <PanelUsuario perfil={perfil} />
          </div>
        </details>
        <div className="h-1 bg-dorado md:hidden" />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
