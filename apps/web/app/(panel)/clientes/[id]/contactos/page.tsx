import { Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { obtenerCliente } from '@/lib/client-data';
import { agregarContacto, desactivarContacto, editarContacto } from '../../actions';
import { FormularioNuevoContacto, TarjetaContacto } from './contact-forms';

export const metadata: Metadata = { title: 'Contactos del cliente · TORRES ASOCIADOS' };

interface PropiedadesPaginaContactos {
  params: Promise<{ id: string }>;
}

export default async function PaginaContactos({ params }: PropiedadesPaginaContactos): Promise<ReactNode> {
  const { id } = await params;
  const resultado = await obtenerCliente(id);

  if (!resultado.ok) {
    return null;
  }

  const cliente = resultado.datos;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Tarjeta titulo="Contactos">
        {cliente.contactos.length === 0 ? (
          <p className="text-sm text-apagado">Este cliente todavía no tiene contactos registrados.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borde">
            {cliente.contactos.map((contacto) => (
              <TarjetaContacto
                key={contacto.id}
                contacto={contacto}
                puedeGestionar={cliente.puedeGestionar}
                editar={editarContacto.bind(null, cliente.id, contacto.id)}
                desactivar={desactivarContacto.bind(null, cliente.id, contacto.id)}
              />
            ))}
          </ul>
        )}
      </Tarjeta>
      {cliente.puedeGestionar ? (
        <Tarjeta titulo="Nuevo contacto">
          <FormularioNuevoContacto accion={agregarContacto.bind(null, cliente.id)} />
        </Tarjeta>
      ) : null}
    </div>
  );
}
