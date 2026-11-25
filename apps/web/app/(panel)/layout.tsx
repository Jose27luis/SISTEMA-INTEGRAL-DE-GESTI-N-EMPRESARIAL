import { esquemaResumenNotificaciones } from '@sige/types';
import { Menu } from 'lucide-react';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Marca } from '@/components/brand';
import { BuscadorGeneral } from '@/components/global-search';
import { MenuNavegacion } from '@/components/navigation-menu';
import { CampanaNotificaciones } from '@/components/notification-bell';
import { PanelUsuario } from '@/components/user-panel';
import { solicitarApi } from '@/lib/api';
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
  const resumen = await solicitarApi('/notificaciones/resumen', { esquema: esquemaResumenNotificaciones });
  const notificaciones = resumen.ok ? resumen.datos : null;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col bg-marino md:flex">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 py-5 pr-3 pl-5">
          <Marca claro />
          <CampanaNotificaciones inicial={notificaciones} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <MenuNavegacion grupos={grupos} />
        </div>
        <PanelUsuario perfil={perfil} />
      </aside>

      <div className="flex min-w-0 flex-col">
        <div className="sticky top-0 z-10 md:hidden">
          <details className="group bg-marino">
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
          <div className="absolute top-1.5 right-24">
            <CampanaNotificaciones inicial={notificaciones} alinear="derecha" />
          </div>
        </div>
        <div className="h-1 bg-dorado md:hidden" />
        <main className="mx-auto w-full max-w-[112rem] flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mb-6 flex justify-end">
            <BuscadorGeneral />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
