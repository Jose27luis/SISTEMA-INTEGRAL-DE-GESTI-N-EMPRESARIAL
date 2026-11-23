import { Alerta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { obtenerPerfil } from '@/lib/profile';
import { ConfiguradorMfa } from './mfa-setup';

export const metadata: Metadata = { title: 'Verificación en dos pasos · TORRES ASOCIADOS' };

export default async function PaginaConfigurarMfa(): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (perfil.pendientes.includes('CAMBIAR_CONTRASENA')) {
    redirect('/cambiar-contrasena');
  }

  if (perfil.usuario.mfaActivo) {
    redirect('/mi-cuenta');
  }

  const obligatorio = perfil.pendientes.includes('CONFIGURAR_MFA');

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-marino">Verificación en dos pasos</h1>
        <p className="text-sm text-apagado">{perfil.usuario.correo}</p>
      </header>
      {obligatorio ? (
        <Alerta tono="aviso">
          Su rol requiere verificación en dos pasos. Configúrela para acceder al sistema.
        </Alerta>
      ) : null}
      <ConfiguradorMfa />
      {obligatorio ? null : (
        <Link href="/mi-cuenta" className="text-center text-sm font-medium text-marino-claro hover:underline">
          Volver a mi cuenta
        </Link>
      )}
    </div>
  );
}
