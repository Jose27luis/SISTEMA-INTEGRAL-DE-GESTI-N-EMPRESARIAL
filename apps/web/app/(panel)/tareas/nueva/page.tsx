import { esquemaOpcionesTarea, esquemaPlantilla, esquemaProyectoDetalle } from '@sige/types';
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
  const proyectoId = z.uuid().safeParse(primerValor(crudos.proyecto));
  const etapaId = primerValor(crudos.etapa);
  const [opciones, plantillas, proyecto] = await Promise.all([
    solicitarApi('/tareas/opciones', { esquema: esquemaOpcionesTarea }),
    solicitarApi('/plantillas', { esquema: esquemaPlantilla.array() }),
    proyectoId.success
      ? solicitarApi(`/proyectos/${proyectoId.data}`, { esquema: esquemaProyectoDetalle })
      : Promise.resolve(null),
  ]);
  const etapa = proyecto?.ok === true ? (proyecto.datos.etapas.find(({ id }) => id === etapaId) ?? null) : null;
  const clienteDelProyecto = proyecto?.ok === true && etapa !== null ? (proyecto.datos.cliente?.id ?? null) : undefined;
  const disponibles = plantillas.ok ? plantillas.datos : [];
  const plantilla = disponibles.find(({ id }) => id === plantillaId) ?? null;
  const enlacePlantilla = (id: string | null): string => {
    const consulta = new URLSearchParams();

    if (clienteInicial.success) {
      consulta.set('cliente', clienteInicial.data);
    }

    if (proyectoId.success && etapa !== null) {
      consulta.set('proyecto', proyectoId.data);
      consulta.set('etapa', etapa.id);
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
        {proyecto?.ok === true && etapa !== null ? (
          <Alerta tono="info" titulo={`Proyecto ${proyecto.datos.codigo} · ${proyecto.datos.nombre}`}>
            La tarea se agregará a la etapa «{etapa.nombre}». El responsable debe ser parte del equipo del proyecto
            {proyecto.datos.cliente === null ? '.' : ` y la tarea queda para ${proyecto.datos.cliente.razonSocial}.`}
          </Alerta>
        ) : null}
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
              clienteInicial={clienteDelProyecto !== undefined ? clienteDelProyecto : clienteInicial.success ? clienteInicial.data : null}
              plantilla={plantilla}
              etapaId={etapa?.id ?? null}
            />
          </Tarjeta>
        ) : (
          <Alerta tono="error">{opciones.error.mensaje}</Alerta>
        )}
      </div>
    </>
  );
}
