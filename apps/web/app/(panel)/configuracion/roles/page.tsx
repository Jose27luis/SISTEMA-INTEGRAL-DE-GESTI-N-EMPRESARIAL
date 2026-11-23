import { esquemaRolResumen, ETIQUETAS_ALCANCE } from '@sige/types';
import { Alerta, Insignia, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';

export const metadata: Metadata = { title: 'Roles y permisos · TORRES ASOCIADOS' };

export default async function PaginaRoles(): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'rol:ver')) {
    return <SinAcceso />;
  }

  const roles = await solicitarApi('/roles', { esquema: esquemaRolResumen.array() });

  return (
    <>
      <EncabezadoPagina
        titulo="Roles y permisos"
        descripcion="Cada rol agrupa permisos y define el alcance sobre clientes y registros."
        acciones={
          tienePermiso(perfil, 'rol:gestionar') ? (
            <Link
              href="/configuracion/roles/nuevo"
              className="inline-flex min-h-11 items-center rounded-md bg-marino px-4 text-sm font-semibold text-white hover:bg-marino-medio"
            >
              Nuevo rol
            </Link>
          ) : null
        }
      />
      {roles.ok ? (
        <div className="grid gap-4 md:grid-cols-2">
          {roles.datos.map((rol) => (
            <Tarjeta key={rol.id}>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/configuracion/roles/${rol.id}`}
                      className="text-lg font-semibold text-marino hover:underline"
                    >
                      {rol.nombre}
                    </Link>
                    <p className="font-mono text-xs text-apagado">{rol.codigo}</p>
                  </div>
                  <span className="flex flex-wrap gap-1.5">
                    {rol.esSistema ? <Insignia tono="info">Del sistema</Insignia> : null}
                    {rol.activo ? null : <Insignia tono="peligro">Desactivado</Insignia>}
                    {rol.exigeMfa ? <Insignia tono="aviso">Exige MFA</Insignia> : null}
                  </span>
                </div>
                {rol.descripcion === null ? null : <p className="text-sm text-tinta">{rol.descripcion}</p>}
                <p className="text-sm text-apagado">
                  {ETIQUETAS_ALCANCE[rol.alcance]} · {rol.permisoIds.length} permisos · {rol.totalUsuarios}{' '}
                  {rol.totalUsuarios === 1 ? 'usuario' : 'usuarios'}
                </p>
              </div>
            </Tarjeta>
          ))}
        </div>
      ) : (
        <Alerta tono="error">{roles.error.mensaje}</Alerta>
      )}
    </>
  );
}
