import { TriangleAlert, Smartphone } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Aparecer } from '@/components/auth/appear';
import { EncabezadoAcceso } from '@/components/auth-heading';
import { obtenerPerfil } from '@/lib/profile';
import { ConfiguradorMfa } from './mfa-setup';

export const metadata: Metadata = { title: 'Verificación en dos pasos · TORRES ASOCIADOS' };

export default async function PaginaConfigurarMfa(): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (perfil.usuario.mfaActivo) {
    redirect('/mi-cuenta');
  }

  const obligatorio = perfil.pendientes.includes('CONFIGURAR_MFA');

  return (
    <>
      <EncabezadoAcceso
        icono={<Smartphone aria-hidden="true" className="size-6" />}
        titulo="Verificación en dos pasos"
        descripcion={perfil.usuario.correo}
      />
      {obligatorio ? (
        <Aparecer>
          <p className="flex items-start gap-2 rounded-xl border border-dorado/50 bg-dorado-suave px-4 py-3 text-sm font-medium text-tinta">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-dorado-oscuro" />
            Su rol requiere verificación en dos pasos. Configúrela una sola vez para acceder al sistema.
          </p>
        </Aparecer>
      ) : null}
      <ConfiguradorMfa />
      {obligatorio ? null : (
        <Aparecer className="text-center">
          <Link href="/mi-cuenta" className="text-sm font-semibold text-marino-claro hover:underline">
            ← Volver a mi cuenta
          </Link>
        </Aparecer>
      )}
    </>
  );
}
