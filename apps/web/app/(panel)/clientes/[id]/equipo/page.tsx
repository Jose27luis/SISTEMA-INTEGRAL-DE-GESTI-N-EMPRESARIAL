import { Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { obtenerCliente } from '@/lib/client-data';
import { asignarUsuario, retirarAsignacion } from '../../actions';
import { usuariosAsignables } from '../../client-options';
import { FilaAsignacion, FormularioAsignacion } from './team-forms';

export const metadata: Metadata = { title: 'Equipo del cliente · TORRES ASOCIADOS' };

interface PropiedadesPaginaEquipo {
  params: Promise<{ id: string }>;
}

export default async function PaginaEquipo({ params }: PropiedadesPaginaEquipo): Promise<ReactNode> {
  const { id } = await params;
  const resultado = await obtenerCliente(id);

  if (!resultado.ok) {
    return null;
  }

  const cliente = resultado.datos;
  const usuarios = cliente.puedeAsignar ? await usuariosAsignables() : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Tarjeta
        titulo="Equipo asignado"
        descripcion="Solo estos usuarios ven el cliente, salvo los roles con alcance global."
      >
        {cliente.asignaciones.length === 0 ? (
          <p className="text-sm text-apagado">Nadie está asignado todavía.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borde">
            {cliente.asignaciones.map((asignacion) => (
              <FilaAsignacion
                key={asignacion.id}
                asignacion={asignacion}
                puedeAsignar={cliente.puedeAsignar}
                retirar={retirarAsignacion.bind(null, cliente.id, asignacion.id)}
              />
            ))}
          </ul>
        )}
      </Tarjeta>
      {cliente.puedeAsignar ? (
        <Tarjeta titulo="Asignar usuario">
          <FormularioAsignacion accion={asignarUsuario.bind(null, cliente.id)} usuarios={usuarios} />
        </Tarjeta>
      ) : null}
    </div>
  );
}
