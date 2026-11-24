import { esquemaPlantilla } from '@sige/types';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { cambiarActivoPlantilla, guardarPlantilla } from './actions';
import { FilaPlantilla, FormularioPlantilla } from './template-forms';

export const metadata: Metadata = { title: 'Plantillas de tareas · TORRES ASOCIADOS' };

export default async function PaginaPlantillas(): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'plantilla:gestionar')) {
    return <SinAcceso />;
  }

  const resultado = await solicitarApi('/plantillas?todas=si', { esquema: esquemaPlantilla.array() });

  return (
    <>
      <EncabezadoPagina
        titulo="Plantillas de tareas"
        descripcion="Tareas frecuentes con instrucciones, evidencia y lista de verificación predefinidas."
        acciones={
          <Link href="/tareas/recurrentes" className="text-sm font-semibold text-marino-claro hover:underline">
            Tareas recurrentes →
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Tarjeta titulo="Plantillas">
          {resultado.ok ? (
            resultado.datos.length === 0 ? (
              <p className="text-sm text-apagado">Todavía no hay plantillas.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-borde">
                {resultado.datos.map((plantilla) => (
                  <FilaPlantilla
                    key={plantilla.id}
                    plantilla={plantilla}
                    editar={guardarPlantilla.bind(null, plantilla.id)}
                    cambiarActivo={cambiarActivoPlantilla.bind(null, plantilla.id, !plantilla.activo)}
                  />
                ))}
              </ul>
            )
          ) : (
            <Alerta tono="error">{resultado.error.mensaje}</Alerta>
          )}
        </Tarjeta>
        <Tarjeta titulo="Nueva plantilla">
          <FormularioPlantilla accion={guardarPlantilla.bind(null, null)} />
        </Tarjeta>
      </div>
    </>
  );
}
