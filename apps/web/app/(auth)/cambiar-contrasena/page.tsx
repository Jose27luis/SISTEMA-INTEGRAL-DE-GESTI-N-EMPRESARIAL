import { Alerta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { obtenerPerfil } from '@/lib/profile';
import { FormularioContrasena } from './password-form';

export const metadata: Metadata = { title: 'Cambiar contraseña · TORRES ASOCIADOS' };

export default async function PaginaCambiarContrasena(): Promise<ReactNode> {
  const perfil = await obtenerPerfil();
  const obligatorio = perfil.pendientes.includes('CAMBIAR_CONTRASENA');

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-marino">Cambiar contraseña</h1>
        <p className="text-sm text-apagado">{perfil.usuario.correo}</p>
      </header>
      {obligatorio ? (
        <Alerta tono="aviso">
          Su cuenta tiene una contraseña temporal. Defina una contraseña personal para continuar.
        </Alerta>
      ) : (
        <Alerta tono="info">Al cambiarla se cerrarán sus sesiones abiertas en otros dispositivos.</Alerta>
      )}
      <FormularioContrasena />
      {obligatorio ? null : (
        <Link href="/mi-cuenta" className="text-center text-sm font-medium text-marino-claro hover:underline">
          Volver a mi cuenta
        </Link>
      )}
    </div>
  );
}
