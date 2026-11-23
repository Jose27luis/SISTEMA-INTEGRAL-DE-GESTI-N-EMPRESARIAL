import { esquemaOpcionesTarea } from '@sige/types';
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

export default async function PaginaNuevaTarea({ searchParams }: PropiedadesPaginaNuevaTarea): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'tarea:crear')) {
    return <SinAcceso />;
  }

  const { cliente } = await searchParams;
  const clienteInicial = z.uuid().safeParse(cliente);
  const opciones = await solicitarApi('/tareas/opciones', { esquema: esquemaOpcionesTarea });

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
      {opciones.ok ? (
        <Tarjeta>
          <FormularioTarea
            accion={crearTarea}
            opciones={opciones.datos}
            tarea={null}
            fechaHoy={fechaHoyEnLima()}
            clienteInicial={clienteInicial.success ? clienteInicial.data : null}
          />
        </Tarjeta>
      ) : (
        <Alerta tono="error">{opciones.error.mensaje}</Alerta>
      )}
    </>
  );
}
