import { Tarjeta } from '@sige/ui/components';
import { Download } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { FormularioImportacion } from './import-form';

export const metadata: Metadata = { title: 'Importar clientes · TORRES ASOCIADOS' };

const PASOS = [
  'Descargue la plantilla: tiene las columnas exactas, listas desplegables y una hoja de instrucciones.',
  'Complete una fila por cliente. Las filas con errores no detienen la importación: se informan al final.',
  'Suba el archivo. Los clientes cuyo RUC o DNI ya existe se rechazan para no duplicarlos.',
] as const;

export default async function PaginaImportarClientes(): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'cliente:gestionar')) {
    return <SinAcceso />;
  }

  return (
    <>
      <EncabezadoPagina
        antetitulo={
          <Link href="/clientes" className="text-sm font-medium text-marino-claro hover:underline">
            ← Clientes
          </Link>
        }
        titulo="Importar clientes desde Excel"
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Tarjeta titulo="Cómo funciona">
          <ol className="flex flex-col gap-3">
            {PASOS.map((paso, indice) => (
              <li key={paso} className="flex items-start gap-3 text-sm">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-marino text-xs font-bold text-white">
                  {indice + 1}
                </span>
                {paso}
              </li>
            ))}
          </ol>
          <a
            href="/clientes/importar/plantilla"
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md border border-borde px-4 text-sm font-semibold text-marino hover:border-marino-claro"
          >
            <Download aria-hidden="true" className="size-4" />
            Descargar plantilla
          </a>
        </Tarjeta>
        <Tarjeta titulo="Subir archivo">
          <FormularioImportacion />
        </Tarjeta>
      </div>
    </>
  );
}
