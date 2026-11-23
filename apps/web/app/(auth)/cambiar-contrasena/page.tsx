import { KeyRound } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Aparecer } from '@/components/auth/appear';
import { EncabezadoAcceso } from '@/components/auth-heading';
import { obtenerPerfil } from '@/lib/profile';
import { FormularioContrasena } from './password-form';

export const metadata: Metadata = { title: 'Cambiar contraseña · TORRES ASOCIADOS' };

export default async function PaginaCambiarContrasena(): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  return (
    <>
      <EncabezadoAcceso
        icono={<KeyRound aria-hidden="true" className="size-6" />}
        titulo="Cambiar contraseña"
        descripcion={perfil.usuario.correo}
      />
      <FormularioContrasena />
      <Aparecer className="text-center">
        <Link href="/mi-cuenta" className="text-sm font-semibold text-marino-claro hover:underline">
          ← Volver a mi cuenta
        </Link>
      </Aparecer>
    </>
  );
}
