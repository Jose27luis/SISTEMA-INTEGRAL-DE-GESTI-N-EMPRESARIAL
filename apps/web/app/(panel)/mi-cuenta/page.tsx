import { esquemaSesionResumen } from '@sige/types';
import { Alerta, Insignia, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { EncabezadoPagina } from '@/components/page-header';
import { TablaSesiones } from '@/components/sessions-table';
import { solicitarApi } from '@/lib/api';
import { obtenerPerfil } from '@/lib/profile';
import { cerrarOtraSesion } from './actions';

export const metadata: Metadata = { title: 'Mi cuenta · TORRES ASOCIADOS' };

const CLASE_ENLACE_ACCION =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-borde px-4 text-sm font-semibold text-marino hover:border-marino-claro';

export default async function PaginaMiCuenta(): Promise<ReactNode> {
  const perfil = await obtenerPerfil();
  const sesiones = await solicitarApi('/auth/sesiones', { esquema: esquemaSesionResumen.array() });

  return (
    <>
      <EncabezadoPagina titulo="Mi cuenta" descripcion={perfil.usuario.correo} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Datos de acceso">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
            <dt className="text-apagado">Nombre</dt>
            <dd className="font-medium">{perfil.usuario.nombre}</dd>
            <dt className="text-apagado">Correo</dt>
            <dd className="font-medium break-all">{perfil.usuario.correo}</dd>
            <dt className="text-apagado">Roles</dt>
            <dd className="flex flex-wrap gap-2">
              {perfil.roles.map((rol) => (
                <Insignia key={rol.id} tono="info">
                  {rol.nombre}
                </Insignia>
              ))}
            </dd>
          </dl>
        </Tarjeta>
        <Tarjeta titulo="Seguridad">
          <div className="flex flex-col gap-4">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              Verificación en dos pasos:
              {perfil.usuario.mfaActivo ? (
                <Insignia tono="exito">Activa</Insignia>
              ) : (
                <Insignia tono="aviso">Inactiva</Insignia>
              )}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/cambiar-contrasena" className={CLASE_ENLACE_ACCION}>
                Cambiar contraseña
              </Link>
              {perfil.usuario.mfaActivo ? null : (
                <Link href="/configurar-mfa" className={CLASE_ENLACE_ACCION}>
                  Activar verificación en dos pasos
                </Link>
              )}
            </div>
          </div>
        </Tarjeta>
        <Tarjeta
          titulo="Sesiones abiertas"
          descripcion="Si no reconoce alguna, ciérrela y cambie su contraseña."
          className="lg:col-span-2"
        >
          {sesiones.ok ? (
            <TablaSesiones
              sesiones={sesiones.datos}
              accion={(sesion) =>
                sesion.actual ? null : (
                  <form action={cerrarOtraSesion}>
                    <input type="hidden" name="sesionId" value={sesion.id} />
                    <button
                      type="submit"
                      className="min-h-11 rounded-md px-3 text-sm font-semibold text-rojo hover:bg-rojo-suave"
                    >
                      Cerrar
                    </button>
                  </form>
                )
              }
            />
          ) : (
            <Alerta tono="error">{sesiones.error.mensaje}</Alerta>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
