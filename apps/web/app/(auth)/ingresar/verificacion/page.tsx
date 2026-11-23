import { ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Aparecer } from '@/components/auth/appear';
import { EncabezadoAcceso } from '@/components/auth-heading';
import { leerDesafio } from '@/lib/session-cookie';
import { FormularioVerificacion } from './mfa-form';

export const metadata: Metadata = { title: 'Verificación en dos pasos · TORRES ASOCIADOS' };

export default async function PaginaVerificacion(): Promise<ReactNode> {
  if ((await leerDesafio()) === null) {
    redirect('/ingresar?motivo=verificacion-vencida');
  }

  return (
    <>
      <EncabezadoAcceso
        icono={<ShieldCheck aria-hidden="true" className="size-6" />}
        titulo="Verificación en dos pasos"
        descripcion="Ingrese el código de 6 dígitos de su aplicación autenticadora."
      />
      <FormularioVerificacion />
      <Aparecer className="text-center">
        <Link href="/ingresar" className="text-sm font-semibold text-marino-claro hover:underline">
          ← Volver al ingreso
        </Link>
      </Aparecer>
    </>
  );
}
