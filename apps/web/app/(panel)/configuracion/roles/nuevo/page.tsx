import { esquemaPermiso } from '@sige/types';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { crearRol } from '../actions';
import { FormularioRol } from '../role-form';

export const metadata: Metadata = { title: 'Nuevo rol · TORRES ASOCIADOS' };

export default async function PaginaNuevoRol(): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'rol:gestionar')) {
    return <SinAcceso />;
  }

  const permisos = await solicitarApi('/permisos', { esquema: esquemaPermiso.array() });

  return (
    <>
      <EncabezadoPagina
        antetitulo={
          <Link href="/configuracion/roles" className="text-sm font-medium text-marino-claro hover:underline">
            ← Roles y permisos
          </Link>
        }
        titulo="Nuevo rol"
      />
      <Tarjeta>
        {permisos.ok ? (
          <FormularioRol permisos={permisos.datos} rol={null} protegido={false} accion={crearRol} />
        ) : (
          <Alerta tono="error">{permisos.error.mensaje}</Alerta>
        )}
      </Tarjeta>
    </>
  );
}
