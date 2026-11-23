import { Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { fechaHoyEnLima } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { crearCliente } from '../actions';
import { FormularioCliente } from '../client-form';
import { cargarOpcionesCliente } from '../client-options';

export const metadata: Metadata = { title: 'Nuevo cliente · TORRES ASOCIADOS' };

export default async function PaginaNuevoCliente(): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'cliente:gestionar')) {
    return <SinAcceso />;
  }

  const opciones = await cargarOpcionesCliente();

  return (
    <>
      <EncabezadoPagina
        antetitulo={
          <Link href="/clientes" className="text-sm font-medium text-marino-claro hover:underline">
            ← Clientes
          </Link>
        }
        titulo="Nuevo cliente"
      />
      <Tarjeta>
        <FormularioCliente
          accion={crearCliente}
          cliente={null}
          regimenes={opciones.regimenes}
          usuarios={opciones.usuarios}
          fechaHoy={fechaHoyEnLima()}
        />
      </Tarjeta>
    </>
  );
}
