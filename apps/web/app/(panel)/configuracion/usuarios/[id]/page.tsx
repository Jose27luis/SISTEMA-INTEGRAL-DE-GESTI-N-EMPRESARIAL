import { esquemaRolResumen, esquemaUsuarioDetalle, esquemaUsuarioResumen } from '@sige/types';
import { Alerta, Insignia, Seleccion, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { FormularioConfirmacion } from '@/components/confirm-action-form';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { TablaSesiones } from '@/components/sessions-table';
import { EstadoUsuario } from '@/components/user-status';
import { solicitarApi } from '@/lib/api';
import { formatearFechaHora } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import {
  activarUsuario,
  asignarRoles,
  desactivarUsuario,
  restablecerContrasena,
  restablecerMfa,
  revocarSesiones,
} from '../actions';
import { FormularioRestablecerContrasena } from './password-reset-form';
import { FormularioRolesUsuario } from './roles-form';

export const metadata: Metadata = { title: 'Usuario · TORRES ASOCIADOS' };

interface PropiedadesPaginaUsuario {
  params: Promise<{ id: string }>;
}

export default async function PaginaUsuario({ params }: PropiedadesPaginaUsuario): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'usuario:ver')) {
    return <SinAcceso />;
  }

  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const usuario = await solicitarApi(`/usuarios/${id}`, { esquema: esquemaUsuarioDetalle });

  if (!usuario.ok) {
    if (usuario.estado === 404) {
      notFound();
    }

    return <Alerta tono="error">{usuario.error.mensaje}</Alerta>;
  }

  const datos = usuario.datos;
  const puedeGestionar = tienePermiso(perfil, 'usuario:gestionar');
  const puedeRevocar = tienePermiso(perfil, 'sesion:revocar');
  const esPropio = datos.id === perfil.usuario.id;
  const roles = tienePermiso(perfil, 'rol:ver')
    ? await solicitarApi('/roles', { esquema: esquemaRolResumen.array() })
    : null;
  const candidatos =
    puedeGestionar && datos.activo && datos.tareasAbiertas > 0
      ? await solicitarApi('/usuarios', { esquema: esquemaUsuarioResumen.array() })
      : null;

  return (
    <>
      <EncabezadoPagina
        antetitulo={
          <Link href="/configuracion/usuarios" className="text-sm font-medium text-marino-claro hover:underline">
            ← Usuarios
          </Link>
        }
        titulo={datos.nombre}
        descripcion={datos.correo}
        acciones={<EstadoUsuario usuario={datos} />}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Roles" descripcion="Determinan los permisos y el alcance del usuario.">
          {puedeGestionar && roles?.ok === true ? (
            <FormularioRolesUsuario
              roles={roles.datos.filter((rol) => rol.activo)}
              asignados={datos.roles.map(({ id: rolId }) => rolId)}
              accion={asignarRoles.bind(null, datos.id)}
            />
          ) : (
            <span className="flex flex-wrap gap-2">
              {datos.roles.map((rol) => (
                <Insignia key={rol.id} tono="info">
                  {rol.nombre}
                </Insignia>
              ))}
            </span>
          )}
        </Tarjeta>

        <Tarjeta titulo="Cuenta">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
            <dt className="text-apagado">Creada</dt>
            <dd>{formatearFechaHora(datos.creadoEn)}</dd>
            <dt className="text-apagado">Último ingreso</dt>
            <dd>{formatearFechaHora(datos.ultimoIngreso)}</dd>
            <dt className="text-apagado">Verificación en dos pasos</dt>
            <dd>{datos.mfaActivo ? 'Activa' : 'Inactiva'}</dd>
          </dl>
          {puedeGestionar && datos.activo && !esPropio ? (
            <div className="mt-6 border-t border-borde pt-4">
              <h3 className="mb-3 text-sm font-semibold text-marino">Asignar nueva contraseña</h3>
              <FormularioRestablecerContrasena accion={restablecerContrasena.bind(null, datos.id)} />
            </div>
          ) : null}
          {puedeGestionar && datos.mfaActivo && !esPropio ? (
            <div className="mt-6 border-t border-borde pt-4">
              <h3 className="mb-3 text-sm font-semibold text-marino">Restablecer verificación en dos pasos</h3>
              <FormularioConfirmacion
                accion={restablecerMfa.bind(null, datos.id)}
                etiquetaBoton="Restablecer"
                textoPendiente="Restableciendo…"
                pedirMotivo
                ayudaMotivo="Por ejemplo: pérdida o cambio de teléfono."
                consecuencia="Se invalidan su aplicación autenticadora y sus códigos de recuperación, y se cierran sus sesiones."
              />
            </div>
          ) : null}
        </Tarjeta>

        <Tarjeta titulo="Sesiones abiertas" className="lg:col-span-2">
          <TablaSesiones sesiones={datos.sesiones} />
          {puedeRevocar && datos.sesiones.length > 0 ? (
            <div className="mt-6 border-t border-borde pt-4">
              <FormularioConfirmacion
                accion={revocarSesiones.bind(null, datos.id)}
                etiquetaBoton="Cerrar todas sus sesiones"
                textoPendiente="Cerrando…"
                variante="peligro"
                pedirMotivo
                consecuencia={
                  esPropio
                    ? 'También se cerrará la sesión que usa ahora.'
                    : 'El usuario deberá ingresar nuevamente en todos sus dispositivos.'
                }
              />
            </div>
          ) : null}
        </Tarjeta>

        {puedeGestionar && !esPropio ? (
          <Tarjeta
            titulo={datos.activo ? 'Desactivar cuenta' : 'Reactivar cuenta'}
            descripcion={
              datos.activo
                ? 'El usuario pierde el acceso; su historial se conserva.'
                : 'El usuario podrá volver a ingresar con su contraseña.'
            }
            className="lg:col-span-2"
          >
            {datos.activo ? (
              <FormularioConfirmacion
                accion={desactivarUsuario.bind(null, datos.id)}
                etiquetaBoton="Desactivar usuario"
                textoPendiente="Desactivando…"
                variante="peligro"
                pedirMotivo
                consecuencia="Se cierran todas sus sesiones y no podrá ingresar hasta que se reactive."
              >
                {datos.tareasAbiertas > 0 ? (
                  <Seleccion
                    id="reasignarAId"
                    name="reasignarAId"
                    etiqueta="Reasignar sus tareas abiertas a"
                    ayuda={`Tiene ${String(datos.tareasAbiertas)} ${datos.tareasAbiertas === 1 ? 'tarea abierta' : 'tareas abiertas'} como responsable o revisor. Quien las reciba debe estar asignado a los clientes de esas tareas.`}
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Seleccione
                    </option>
                    {(candidatos?.ok === true ? candidatos.datos : [])
                      .filter((candidato) => candidato.activo && candidato.id !== datos.id)
                      .map((candidato) => (
                        <option key={candidato.id} value={candidato.id}>
                          {candidato.nombre}
                        </option>
                      ))}
                  </Seleccion>
                ) : null}
              </FormularioConfirmacion>
            ) : (
              <FormularioConfirmacion
                accion={activarUsuario.bind(null, datos.id)}
                etiquetaBoton="Reactivar usuario"
                textoPendiente="Reactivando…"
                variante="primario"
                pedirMotivo
                consecuencia="El usuario recupera el acceso con los roles que tenga asignados."
              />
            )}
          </Tarjeta>
        ) : null}
      </div>
    </>
  );
}
