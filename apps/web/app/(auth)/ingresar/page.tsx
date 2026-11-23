import { Alerta } from '@sige/ui/components';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
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
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-marino">Ingresar</h1>
        <p className="text-sm text-apagado">Use el correo y la contraseña de su cuenta personal.</p>
      </header>
      {aviso === undefined ? null : <Alerta tono="info">{aviso}</Alerta>}
      <FormularioIngreso />
    </div>
  );
}
