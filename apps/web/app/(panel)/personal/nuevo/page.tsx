import { esquemaRolResumen, esquemaUsuarioSinFicha } from '@sige/types';
import { Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { crearTrabajador } from '../actions';
import { FormularioTrabajador } from '../staff-form';
import { cargarOpcionesFicha } from '../staff-options';

export const metadata: Metadata = { title: 'Nuevo trabajador · TORRES ASOCIADOS' };

export default async function PaginaNuevoTrabajador(): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'personal:gestionar')) {
    return <SinAcceso />;
  }

  const [opciones, roles, usuariosSinFicha] = await Promise.all([
    cargarOpcionesFicha(),
    solicitarApi('/roles', { esquema: esquemaRolResumen.array() }),
    solicitarApi('/personal/usuarios-sin-ficha', { esquema: esquemaUsuarioSinFicha.array() }),
  ]);

  return (
    <>
      <EncabezadoPagina
        antetitulo={
          <Link href="/personal" className="text-sm font-medium text-marino-claro hover:underline">
            ← Personal
          </Link>
        }
        titulo="Nuevo trabajador"
        descripcion="Registra la ficha y la cuenta con la que ingresará al sistema."
      />
      <Tarjeta>
        <FormularioTrabajador
          accion={crearTrabajador}
          opciones={opciones}
          trabajador={null}
          cuenta={{
            roles: roles.ok ? roles.datos.filter(({ activo }) => activo) : [],
            usuariosSinFicha: usuariosSinFicha.ok ? usuariosSinFicha.datos : [],
          }}
        />
      </Tarjeta>
    </>
  );
}
