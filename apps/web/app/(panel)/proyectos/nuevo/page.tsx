import { esquemaOpcionesProyecto } from '@sige/types';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { fechaHoyEnLima } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { crearProyecto } from '../actions';
import { FormularioProyecto } from '../project-forms';

export const metadata: Metadata = { title: 'Nuevo proyecto · TORRES ASOCIADOS' };

export default async function PaginaNuevoProyecto(): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'proyecto:crear')) {
    return <SinAcceso />;
  }

  const opciones = await solicitarApi('/proyectos/opciones', { esquema: esquemaOpcionesProyecto });

  return (
    <>
      <EncabezadoPagina
        antetitulo={
          <Link href="/proyectos" className="text-sm font-medium text-marino-claro hover:underline">
            ← Proyectos
          </Link>
        }
        titulo="Nuevo proyecto"
        descripcion="Después podrá agregar las etapas, sus entregables y las tareas."
      />
      {opciones.ok ? (
        <Tarjeta className="max-w-3xl">
          <FormularioProyecto
            accion={crearProyecto}
            opciones={opciones.datos}
            proyecto={null}
            hoy={fechaHoyEnLima()}
            usuarioId={perfil.usuario.id}
          />
        </Tarjeta>
      ) : (
        <Alerta tono="error">{opciones.error.mensaje}</Alerta>
      )}
    </>
  );
}
