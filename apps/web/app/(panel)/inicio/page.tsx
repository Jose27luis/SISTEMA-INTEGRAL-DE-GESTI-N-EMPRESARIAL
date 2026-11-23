import { Insignia, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { EncabezadoPagina } from '@/components/page-header';
import { formatearFechaHora } from '@/lib/format';
import { navegacionPermitida } from '@/lib/navigation';
import { obtenerPerfil } from '@/lib/profile';

export const metadata: Metadata = { title: 'Inicio · TORRES ASOCIADOS' };

export default async function PaginaInicio(): Promise<ReactNode> {
  const perfil = await obtenerPerfil();
  const accesos = navegacionPermitida(perfil.permisos)
    .flatMap(({ elementos }) => elementos)
    .filter(({ ruta }) => ruta !== '/inicio');

  return (
    <>
      <EncabezadoPagina
        titulo={`Hola, ${perfil.usuario.nombre}`}
        descripcion={`Último ingreso: ${formatearFechaHora(perfil.usuario.ultimoIngreso)}`}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Su acceso" descripcion="Roles asignados a su cuenta.">
          <div className="flex flex-wrap gap-2">
            {perfil.roles.map((rol) => (
              <Insignia key={rol.id} tono="info">
                {rol.nombre}
              </Insignia>
            ))}
          </div>
          <p className="mt-4 text-sm text-apagado">
            Verificación en dos pasos:{' '}
            {perfil.usuario.mfaActivo ? (
              <Insignia tono="exito">Activa</Insignia>
            ) : (
              <Insignia tono="aviso">Inactiva</Insignia>
            )}
          </p>
        </Tarjeta>
        <Tarjeta titulo="Accesos directos">
          <ul className="flex flex-col divide-y divide-borde">
            {accesos.map((acceso) => (
              <li key={acceso.ruta}>
                <Link
                  href={acceso.ruta}
                  className="flex min-h-11 items-center justify-between text-sm font-medium text-marino hover:text-marino-claro"
                >
                  {acceso.etiqueta}
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>
    </>
  );
}
