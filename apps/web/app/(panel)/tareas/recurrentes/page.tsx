import { esquemaOpcionesTarea, esquemaPlantilla, esquemaRegla } from '@sige/types';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { fechaHoyEnLima } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { cambiarActivoRegla, crearRegla } from '../../configuracion/plantillas/actions';
import { FilaRegla, FormularioRegla } from './recurrence-forms';

export const metadata: Metadata = { title: 'Tareas recurrentes · TORRES ASOCIADOS' };

export default async function PaginaTareasRecurrentes(): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'plantilla:gestionar')) {
    return <SinAcceso />;
  }

  const [reglas, plantillas, opciones] = await Promise.all([
    solicitarApi('/tareas-recurrentes', { esquema: esquemaRegla.array() }),
    solicitarApi('/plantillas', { esquema: esquemaPlantilla.array() }),
    solicitarApi('/tareas/opciones', { esquema: esquemaOpcionesTarea }),
  ]);

  return (
    <>
      <EncabezadoPagina
        antetitulo={
          <Link href="/tareas" className="text-sm font-medium text-marino-claro hover:underline">
            ← Tareas
          </Link>
        }
        titulo="Tareas recurrentes"
        descripcion="Reglas que crean tareas solas a partir de una plantilla, cada mes o cada semana."
        acciones={
          <Link href="/configuracion/plantillas" className="text-sm font-semibold text-marino-claro hover:underline">
            Plantillas →
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Tarjeta titulo="Reglas">
          {reglas.ok ? (
            reglas.datos.length === 0 ? (
              <p className="text-sm text-apagado">No hay tareas recurrentes.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-borde">
                {reglas.datos.map((regla) => (
                  <FilaRegla key={regla.id} regla={regla} cambiarActivo={cambiarActivoRegla.bind(null, regla.id, !regla.activo)} />
                ))}
              </ul>
            )
          ) : (
            <Alerta tono="error">{reglas.error.mensaje}</Alerta>
          )}
        </Tarjeta>
        <Tarjeta titulo="Nueva tarea recurrente">
          {plantillas.ok && opciones.ok ? (
            plantillas.datos.length === 0 ? (
              <p className="text-sm text-apagado">
                Primero cree una plantilla en{' '}
                <Link href="/configuracion/plantillas" className="font-semibold text-marino-claro hover:underline">
                  Plantillas de tareas
                </Link>
                .
              </p>
            ) : (
              <FormularioRegla
                accion={crearRegla}
                plantillas={plantillas.datos.map(({ id, nombre }) => ({ id, nombre }))}
                clientes={opciones.datos.clientes}
                usuarios={opciones.datos.usuarios}
                fechaHoy={fechaHoyEnLima()}
              />
            )
          ) : (
            <Alerta tono="error">No se pudieron cargar las opciones.</Alerta>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
