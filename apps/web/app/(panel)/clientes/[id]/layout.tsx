import { ETIQUETAS_TIPO_PERSONA } from '@sige/types';
import { Alerta } from '@sige/ui/components';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { EstadoClienteInsignia } from '@/components/client-status';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { obtenerCliente } from '@/lib/client-data';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { PestanasCliente } from './client-tabs';

interface PropiedadesLayoutCliente {
  children: ReactNode;
  params: Promise<{ id: string }>;
}

export default async function LayoutCliente({ children, params }: PropiedadesLayoutCliente): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'cliente:ver')) {
    return <SinAcceso />;
  }

  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const resultado = await obtenerCliente(id);

  if (!resultado.ok) {
    if (resultado.estado === 404) {
      notFound();
    }

    return resultado.estado === 403 ? (
      <Alerta tono="aviso" titulo="Sin acceso">
        No tiene asignado este cliente. Solicite a Gerencia General que lo incluya en su equipo.
      </Alerta>
    ) : (
      <Alerta tono="error">{resultado.error.mensaje}</Alerta>
    );
  }

  const cliente = resultado.datos;
  const documento = cliente.ruc === null ? `DNI ${cliente.dni ?? ''}` : `RUC ${cliente.ruc}`;

  return (
    <>
      <EncabezadoPagina
        antetitulo={
          <Link href="/clientes" className="text-sm font-medium text-marino-claro hover:underline">
            ← Clientes
          </Link>
        }
        titulo={cliente.razonSocial}
        descripcion={`${documento} · ${ETIQUETAS_TIPO_PERSONA[cliente.tipoPersona]}`}
        acciones={<EstadoClienteInsignia estado={cliente.estado} />}
      />
      <PestanasCliente
        clienteId={cliente.id}
        totalContactos={cliente.contactos.length}
        totalEquipo={cliente.asignaciones.length}
      />
      {children}
    </>
  );
}
