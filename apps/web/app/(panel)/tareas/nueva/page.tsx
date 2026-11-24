import { esquemaOpcionesTarea, esquemaPlantilla } from '@sige/types';
import { cn } from '@sige/ui/cn';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { fechaHoyEnLima } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { crearTarea } from '../actions';
import { FormularioTarea } from '../task-form';

export const metadata: Metadata = { title: 'Nueva tarea · TORRES ASOCIADOS' };

interface PropiedadesPaginaNuevaTarea {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function primerValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? '';
}

export default async function PaginaNuevaTarea({ searchParams }: PropiedadesPaginaNuevaTarea): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'tarea:crear')) {
    return <SinAcceso />;
  }

  const crudos = await searchParams;
  const clienteInicial = z.uuid().safeParse(primerValor(crudos.cliente));
  const plantillaId = primerValor(crudos.plantilla);
  const [opciones, plantillas] = await Promise.all([
    solicitarApi('/tareas/opciones', { esquema: esquemaOpcionesTarea }),
    solicitarApi('/plantillas', { esquema: esquemaPlantilla.array() }),
  ]);
  const disponibles = plantillas.ok ? plantillas.datos : [];
  const plantilla = disponibles.find(({ id }) => id === plantillaId) ?? null;
  const enlacePlantilla = (id: string | null): string => {
    const consulta = new URLSearchParams();

    if (clienteInicial.success) {
      consulta.set('cliente', clienteInicial.data);
    }

    if (id !== null) {
      consulta.set('plantilla', id);
    }

    return `/tareas/nueva?${consulta.toString()}`;
  };

  return (
    <>
      <EncabezadoPagina
        antetitulo={
          <Link href="/tareas" className="text-sm font-medium text-marino-claro hover:underline">
            ← Tareas
          </Link>
        }
        titulo="Nueva tarea"
        descripcion="El responsable y los colaboradores reciben una notificación al guardarla."
      />
      <div className="flex flex-col gap-6">
        {disponibles.length > 0 ? (
          <Tarjeta
            titulo="Empezar desde una plantilla"
            descripcion="Completa título, instrucciones, plazo, evidencia y lista de verificación."
          >
            <nav aria-label="Plantillas" className="flex flex-wrap gap-2">
              <Link
                href={enlacePlantilla(null)}
                aria-current={plantilla === null ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-9 items-center rounded-md border px-3 text-sm font-semibold',
                  plantilla === null ? 'border-marino bg-marino text-white' : 'border-borde text-marino hover:bg-marino/5',
                )}
              >
                Sin plantilla
              </Link>
              {disponibles.map((opcion) => (
                <Link
                  key={opcion.id}
                  href={enlacePlantilla(opcion.id)}
                  aria-current={plantilla?.id === opcion.id ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-9 items-center rounded-md border px-3 text-sm font-semibold',
                    plantilla?.id === opcion.id
                      ? 'border-marino bg-marino text-white'
                      : 'border-borde text-marino hover:bg-marino/5',
                  )}
                >
                  {opcion.nombre}
                </Link>
              ))}
            </nav>
          </Tarjeta>
        ) : null}
        {opciones.ok ? (
          <Tarjeta>
            <FormularioTarea
              key={plantilla?.id ?? 'libre'}
              accion={crearTarea}
              opciones={opciones.datos}
              tarea={null}
              fechaHoy={fechaHoyEnLima()}
              clienteInicial={clienteInicial.success ? clienteInicial.data : null}
              plantilla={plantilla}
            />
          </Tarjeta>
        ) : (
          <Alerta tono="error">{opciones.error.mensaje}</Alerta>
        )}
      </div>
    </>
  );
}
