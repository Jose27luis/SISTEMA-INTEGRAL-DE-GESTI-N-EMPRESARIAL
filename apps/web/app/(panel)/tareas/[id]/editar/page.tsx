import { esquemaOpcionesTarea, esquemaTareaDetalle } from '@sige/types';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { fechaHoyEnLima } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { editarTarea } from '../../actions';
import { FormularioTarea } from '../../task-form';

export const metadata: Metadata = { title: 'Editar tarea · TORRES ASOCIADOS' };

interface PropiedadesPaginaEditarTarea {
  params: Promise<{ id: string }>;
}

export default async function PaginaEditarTarea({ params }: PropiedadesPaginaEditarTarea): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'tarea:crear')) {
    return <SinAcceso />;
  }

  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const [tarea, opciones] = await Promise.all([
    solicitarApi(`/tareas/${id}`, { esquema: esquemaTareaDetalle }),
    solicitarApi('/tareas/opciones', { esquema: esquemaOpcionesTarea }),
  ]);

  if (!tarea.ok) {
    if (tarea.estado === 404) {
      notFound();
    }

    return <Alerta tono="error">{tarea.error.mensaje}</Alerta>;
  }

  return (
    <>
      <EncabezadoPagina
        antetitulo={
          <Link href={`/tareas/${id}`} className="text-sm font-medium text-marino-claro hover:underline">
            ← {tarea.datos.codigo}
          </Link>
        }
        titulo="Editar tarea"
        descripcion="Los participantes reciben una notificación con los cambios."
      />
      {!tarea.datos.acciones.editar ? (
        <Alerta tono="aviso">
          Solo quien asignó la tarea o Gerencia puede modificarla mientras esté abierta.
        </Alerta>
      ) : opciones.ok ? (
        <Tarjeta>
          <FormularioTarea
            accion={editarTarea.bind(null, id)}
            opciones={opciones.datos}
            tarea={tarea.datos}
            fechaHoy={fechaHoyEnLima()}
            clienteInicial={null}
          />
        </Tarjeta>
      ) : (
        <Alerta tono="error">{opciones.error.mensaje}</Alerta>
      )}
    </>
  );
}
