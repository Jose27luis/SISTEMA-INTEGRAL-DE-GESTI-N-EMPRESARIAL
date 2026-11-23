import type { ReactNode } from 'react';
import { EstadoServicio } from '@/components/service-status';
import { consultarSalud } from '@/lib/health';

export const dynamic = 'force-dynamic';

export default async function PaginaInicio(): Promise<ReactNode> {
  const salud = await consultarSalud();

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-8 px-4 py-12">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold tracking-widest text-dorado uppercase">
          TORRES ASOCIADOS
        </p>
        <h1 className="text-3xl font-bold text-marino">Sistema Integral de Gestión Empresarial</h1>
      </header>

      <section aria-labelledby="titulo-estado" className="flex flex-col gap-3">
        <h2 id="titulo-estado" className="text-lg font-semibold text-marino">
          Estado de los servicios
        </h2>
        <ul className="flex flex-col gap-2">
          <EstadoServicio nombre="API" disponible={salud !== null} />
          <EstadoServicio nombre="Base de datos" disponible={salud?.baseDatos === 'ok'} />
        </ul>
      </section>
    </main>
  );
}
