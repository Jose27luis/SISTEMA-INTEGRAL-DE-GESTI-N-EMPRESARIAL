import type { ReactNode } from 'react';
import { Marca } from '@/components/brand';

interface PropiedadesLayoutAcceso {
  children: ReactNode;
}

export default function LayoutAcceso({ children }: PropiedadesLayoutAcceso): ReactNode {
  return (
    <div className="flex min-h-dvh flex-col bg-marino">
      <div className="h-1 bg-dorado" />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-md flex-col gap-6">
          <Marca claro />
          <div className="rounded-lg bg-superficie p-6 shadow-xl sm:p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
