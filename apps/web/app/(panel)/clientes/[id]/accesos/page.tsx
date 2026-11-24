import { esquemaAccesosCliente, esquemaPlataforma } from '@sige/types';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { solicitarApi } from '@/lib/api';
import { obtenerCliente } from '@/lib/client-data';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { FilaAcceso, FormularioAcceso } from './access-forms';
import { guardarAcceso } from './actions';

export const metadata: Metadata = { title: 'Accesos del cliente · TORRES ASOCIADOS' };

interface PropiedadesPaginaAccesos {
  params: Promise<{ id: string }>;
}

export default async function PaginaAccesos({ params }: PropiedadesPaginaAccesos): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'acceso:ver')) {
    return <SinAcceso />;
  }

  const { id } = await params;
  const [cliente, accesos, plataformas] = await Promise.all([
    obtenerCliente(id),
    solicitarApi(`/accesos/clientes/${id}`, { esquema: esquemaAccesosCliente }),
    solicitarApi('/accesos/plataformas', { esquema: esquemaPlataforma.array() }),
  ]);

  if (!cliente.ok) {
    return null;
  }

  if (!accesos.ok) {
    return <Alerta tono="error">{accesos.error.mensaje}</Alerta>;
  }

  const equipo = cliente.datos.asignaciones.map(({ usuario }) => ({ id: usuario.id, nombre: usuario.nombre }));
  const opcionesPlataforma = plataformas.ok ? plataformas.datos : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Tarjeta titulo="Accesos de plataformas" descripcion="Cada consulta de esta sección queda registrada en la auditoría.">
        {accesos.datos.accesos.length === 0 ? (
          <p className="text-sm text-apagado">No hay accesos registrados.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borde">
            {accesos.datos.accesos.map((acceso) => (
              <FilaAcceso
                key={acceso.id}
                acceso={acceso}
                editar={guardarAcceso.bind(null, id, acceso.id)}
                plataformas={opcionesPlataforma}
                equipo={equipo}
                puedeGestionar={accesos.datos.puedeGestionar}
              />
            ))}
          </ul>
        )}
      </Tarjeta>
      {accesos.datos.puedeGestionar ? (
        <Tarjeta titulo="Registrar acceso">
          {equipo.length === 0 ? (
            <p className="text-sm text-apagado">Asigne primero al equipo del cliente: el responsable autorizado sale de ahí.</p>
          ) : (
            <FormularioAcceso accion={guardarAcceso.bind(null, id, null)} plataformas={opcionesPlataforma} equipo={equipo} />
          )}
        </Tarjeta>
      ) : null}
    </div>
  );
}
