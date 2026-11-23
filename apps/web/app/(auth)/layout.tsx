import type { ReactNode } from 'react';
import { AmbienteAcceso } from '@/components/auth/access-background';
import { PanelMarca } from '@/components/auth/brand-panel';

interface PropiedadesLayoutAcceso {
  children: ReactNode;
}

export default function LayoutAcceso({ children }: PropiedadesLayoutAcceso): ReactNode {
  return (
    <div className="grid min-h-dvh bg-fondo lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <PanelMarca />
      <main className="relative flex flex-col overflow-hidden px-4 py-8 sm:px-10">
        <AmbienteAcceso />
        <div className="relative flex flex-1 items-center justify-center py-6">{children}</div>
        <p className="relative text-center text-xs text-apagado">
          Acceso exclusivo para el personal de TORRES ASOCIADOS S.A.C.
        </p>
      </main>
    </div>
  );
}
