import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { leerDesafio } from '@/lib/session-cookie';
import { FormularioVerificacion } from './mfa-form';

export const metadata: Metadata = { title: 'Verificación en dos pasos · TORRES ASOCIADOS' };

export default async function PaginaVerificacion(): Promise<ReactNode> {
  if ((await leerDesafio()) === null) {
    redirect('/ingresar?motivo=verificacion-vencida');
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-marino">Verificación en dos pasos</h1>
        <p className="text-sm text-apagado">
          Abra su aplicación autenticadora e ingrese el código vigente de TORRES ASOCIADOS SIGE.
        </p>
      </header>
      <FormularioVerificacion />
      <Link href="/ingresar" className="text-center text-sm font-medium text-marino-claro hover:underline">
        Volver al ingreso
      </Link>
    </div>
  );
}
