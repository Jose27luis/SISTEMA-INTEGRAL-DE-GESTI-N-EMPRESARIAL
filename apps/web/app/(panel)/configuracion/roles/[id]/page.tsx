import { ETIQUETAS_ALCANCE, esquemaPermiso, esquemaRolResumen } from '@sige/types';
import { Alerta, Insignia, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { FormularioConfirmacion } from '@/components/confirm-action-form';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { cambiarEstadoRol, editarRol } from '../actions';
import { FormularioRol } from '../role-form';

export const metadata: Metadata = { title: 'Rol · TORRES ASOCIADOS' };

const CODIGO_ROL_GERENCIA = 'GERENCIA';

interface PropiedadesPaginaRol {
  params: Promise<{ id: string }>;
}

export default async function PaginaRol({ params }: PropiedadesPaginaRol): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'rol:ver')) {
    return <SinAcceso />;
  }

  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const [rol, permisos] = await Promise.all([
    solicitarApi(`/roles/${id}`, { esquema: esquemaRolResumen }),
    solicitarApi('/permisos', { esquema: esquemaPermiso.array() }),
  ]);

  if (!rol.ok) {
    if (rol.estado === 404) {
      notFound();
    }

    return <Alerta tono="error">{rol.error.mensaje}</Alerta>;
  }

  const datos = rol.datos;
  const puedeGestionar = tienePermiso(perfil, 'rol:gestionar');

  return (
    <>
      <EncabezadoPagina
        antetitulo={
          <Link href="/configuracion/roles" className="text-sm font-medium text-marino-claro hover:underline">
            ← Roles y permisos
          </Link>
        }
        titulo={datos.nombre}
        descripcion={`${datos.codigo} · ${ETIQUETAS_ALCANCE[datos.alcance]}`}
        acciones={
          <span className="flex flex-wrap gap-1.5">
            {datos.esSistema ? <Insignia tono="info">Del sistema</Insignia> : null}
            {datos.activo ? <Insignia tono="exito">Activo</Insignia> : <Insignia tono="peligro">Desactivado</Insignia>}
          </span>
        }
      />
      <div className="flex flex-col gap-6">
        <Tarjeta>
          {!permisos.ok ? (
            <Alerta tono="error">{permisos.error.mensaje}</Alerta>
          ) : puedeGestionar ? (
            <FormularioRol
              permisos={permisos.datos}
              rol={datos}
              protegido={datos.codigo === CODIGO_ROL_GERENCIA}
              accion={editarRol.bind(null, datos.id)}
            />
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {permisos.datos
                .filter((permiso) => datos.permisoIds.includes(permiso.id))
                .map((permiso) => (
                  <li key={permiso.id}>{permiso.descripcion}</li>
                ))}
            </ul>
          )}
        </Tarjeta>
        {puedeGestionar && !datos.esSistema ? (
          <Tarjeta
            titulo={datos.activo ? 'Desactivar rol' : 'Activar rol'}
            descripcion={
              datos.activo
                ? 'Solo se puede desactivar cuando ningún usuario activo lo tiene asignado.'
                : 'El rol volverá a estar disponible para asignarse.'
            }
          >
            <FormularioConfirmacion
              accion={cambiarEstadoRol.bind(null, datos.id, !datos.activo)}
              etiquetaBoton={datos.activo ? 'Desactivar rol' : 'Activar rol'}
              textoPendiente="Guardando…"
              variante={datos.activo ? 'peligro' : 'primario'}
              consecuencia={
                datos.activo
                  ? 'El rol dejará de poder asignarse y sus permisos no se aplicarán.'
                  : 'Los usuarios a los que se asigne recibirán sus permisos.'
              }
            />
          </Tarjeta>
        ) : null}
      </div>
    </>
  );
}
