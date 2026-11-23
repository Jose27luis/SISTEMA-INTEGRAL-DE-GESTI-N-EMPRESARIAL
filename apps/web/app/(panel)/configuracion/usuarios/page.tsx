import { esquemaUsuarioResumen } from '@sige/types';
import { Alerta, Insignia, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { EstadoUsuario } from '@/components/user-status';
import { solicitarApi } from '@/lib/api';
import { formatearFechaHora } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';

export const metadata: Metadata = { title: 'Usuarios · TORRES ASOCIADOS' };

export default async function PaginaUsuarios(): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'usuario:ver')) {
    return <SinAcceso />;
  }

  const usuarios = await solicitarApi('/usuarios', { esquema: esquemaUsuarioResumen.array() });

  return (
    <>
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion="Cuentas de acceso, roles asignados y estado de seguridad."
      />
      {usuarios.ok ? (
        <Tarjeta>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="border-b border-borde text-xs tracking-wide text-apagado uppercase">
                <tr>
                  <th scope="col" className="py-3 pr-4 font-semibold">Usuario</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Roles</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Estado</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Último ingreso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {usuarios.datos.map((usuario) => (
                  <tr key={usuario.id}>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/configuracion/usuarios/${usuario.id}`}
                        className="font-semibold text-marino hover:underline"
                      >
                        {usuario.nombre}
                      </Link>
                      <p className="text-xs text-apagado">{usuario.correo}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="flex flex-wrap gap-1.5">
                        {usuario.roles.length === 0 ? (
                          <span className="text-apagado">Sin roles</span>
                        ) : (
                          usuario.roles.map((rol) => (
                            <Insignia key={rol.id} tono="info">
                              {rol.nombre}
                            </Insignia>
                          ))
                        )}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <EstadoUsuario usuario={usuario} />
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap text-apagado">
                      {formatearFechaHora(usuario.ultimoIngreso)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      ) : (
        <Alerta tono="error">{usuarios.error.mensaje}</Alerta>
      )}
    </>
  );
}
