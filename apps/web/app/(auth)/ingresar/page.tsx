import { Info } from 'lucide-react';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Aparecer } from '@/components/auth/appear';
import { EncabezadoAcceso } from '@/components/auth-heading';
import { FormularioIngreso } from './login-form';

export const metadata: Metadata = { title: 'Ingresar · TORRES ASOCIADOS' };

const AVISOS: Partial<Record<string, string>> = {
  expirada: 'Su sesión expiró o fue cerrada. Ingrese nuevamente.',
  'verificacion-vencida': 'La verificación en dos pasos venció. Ingrese nuevamente.',
  salida: 'Cerró su sesión correctamente.',
};

interface PropiedadesPaginaIngreso {
  searchParams: Promise<{ motivo?: string | string[] }>;
}

export default async function PaginaIngreso({ searchParams }: PropiedadesPaginaIngreso): Promise<ReactNode> {
  const { motivo } = await searchParams;
  const aviso = typeof motivo === 'string' ? AVISOS[motivo] : undefined;

  return (
    <>
      <EncabezadoAcceso titulo="Bienvenido" descripcion="Ingrese con su correo y contraseña." />
      {aviso === undefined ? null : (
        <Aparecer>
          <p
            role="status"
            className="flex items-center gap-2 rounded-xl border border-marino-claro/20 bg-marino/5 px-4 py-3 text-sm font-medium text-marino"
          >
            <Info aria-hidden="true" className="size-5 shrink-0" />
            {aviso}
          </p>
        </Aparecer>
      )}
      <FormularioIngreso />
      <Aparecer>
        <p className="text-center text-sm text-apagado">
          ¿Olvidó su contraseña? Solicite a Gerencia General que la restablezca.
        </p>
      </Aparecer>
    </>
  );
}
