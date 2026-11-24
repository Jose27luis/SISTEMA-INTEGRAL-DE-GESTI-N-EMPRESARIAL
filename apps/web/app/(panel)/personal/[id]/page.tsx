import { esquemaTrabajadorDetalle } from '@sige/types';
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
import { fechaHoyEnLima, formatearFecha } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { cesarTrabajador, editarTrabajador, reactivarTrabajador } from '../actions';
import { FormularioTrabajador } from '../staff-form';
import { cargarOpcionesFicha } from '../staff-options';
import { FormularioBaja } from './termination-form';

export const metadata: Metadata = { title: 'Trabajador · TORRES ASOCIADOS' };

interface PropiedadesPaginaTrabajador {
  params: Promise<{ id: string }>;
}

export default async function PaginaTrabajador({ params }: PropiedadesPaginaTrabajador): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'personal:ver')) {
    return <SinAcceso />;
  }

  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const resultado = await solicitarApi(`/personal/${id}`, { esquema: esquemaTrabajadorDetalle });

  if (!resultado.ok) {
    if (resultado.estado === 404) {
      notFound();
    }

    return <Alerta tono="error">{resultado.error.mensaje}</Alerta>;
  }

  const trabajador = resultado.datos;
  const puedeGestionar = tienePermiso(perfil, 'personal:gestionar');
  const esPropio = trabajador.usuarioId === perfil.usuario.id;
  const opciones = puedeGestionar ? await cargarOpcionesFicha() : null;

  return (
    <>
      <EncabezadoPagina
        antetitulo={
          <Link href="/personal" className="text-sm font-medium text-marino-claro hover:underline">
            ← Personal
          </Link>
        }
        titulo={`${trabajador.nombres} ${trabajador.apellidos}`}
        descripcion={`${trabajador.cargo.nombre} · ${trabajador.area.nombre}`}
        acciones={
          trabajador.estado === 'ACTIVO' ? (
            <Insignia tono="exito">Activo</Insignia>
          ) : (
            <Insignia tono="peligro">
              De baja{trabajador.fechaCese === null ? '' : ` desde ${formatearFecha(trabajador.fechaCese)}`}
            </Insignia>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Tarjeta titulo="Ficha">
          {opciones === null ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
              <dt className="text-apagado">DNI</dt>
              <dd>{trabajador.dni}</dd>
              <dt className="text-apagado">Tipo de vínculo</dt>
              <dd>{trabajador.tipoVinculo.nombre}</dd>
              <dt className="text-apagado">Incorporación</dt>
              <dd>{formatearFecha(trabajador.fechaIncorporacion)}</dd>
              <dt className="text-apagado">Horario</dt>
              <dd>{trabajador.horario ?? 'No registrado'}</dd>
              <dt className="text-apagado">Teléfono</dt>
              <dd>{trabajador.telefono ?? 'No registrado'}</dd>
              <dt className="text-apagado">Supervisor</dt>
              <dd>{trabajador.supervisor?.nombre ?? 'Sin supervisor'}</dd>
              <dt className="text-apagado">Funciones</dt>
              <dd className="whitespace-pre-line">{trabajador.funciones ?? 'No registradas'}</dd>
            </dl>
          ) : (
            <FormularioTrabajador
              accion={editarTrabajador.bind(null, trabajador.id)}
              opciones={opciones}
              trabajador={trabajador}
              cuenta={null}
            />
          )}
        </Tarjeta>

        <div className="flex flex-col gap-6">
          <Tarjeta titulo="Cuenta de acceso">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
              <dt className="text-apagado">Correo</dt>
              <dd className="break-all">{trabajador.correo}</dd>
              <dt className="text-apagado">Roles</dt>
              <dd className="flex flex-wrap gap-1.5">
                {trabajador.roles.length === 0
                  ? 'Sin roles'
                  : trabajador.roles.map((rol) => (
                      <Insignia key={rol.id} tono="info">
                        {rol.nombre}
                      </Insignia>
                    ))}
              </dd>
              <dt className="text-apagado">Clientes asignados</dt>
              <dd>{trabajador.clientesAsignados}</dd>
            </dl>
            {tienePermiso(perfil, 'tarea:ver') && (perfil.alcanceGlobal || esPropio) ? (
              <Link
                href={`/historial/${trabajador.usuarioId}`}
                className="mt-4 mr-4 inline-flex text-sm font-semibold text-marino-claro hover:underline"
              >
                Historial y cumplimiento →
              </Link>
            ) : null}
            {tienePermiso(perfil, 'usuario:ver') ? (
              <Link
                href={`/configuracion/usuarios/${trabajador.usuarioId}`}
                className="mt-4 inline-flex text-sm font-semibold text-marino-claro hover:underline"
              >
                Gestionar cuenta, roles y contraseña →
              </Link>
            ) : null}
          </Tarjeta>

          {puedeGestionar && !esPropio ? (
            <Tarjeta
              titulo={trabajador.estado === 'ACTIVO' ? 'Registrar baja' : 'Reactivar'}
              descripcion={
                trabajador.estado === 'ACTIVO'
                  ? 'Para el cese de labores del trabajador.'
                  : 'Devuelve el acceso con los roles que conserva.'
              }
            >
              {trabajador.estado === 'ACTIVO' ? (
                <FormularioBaja
                  accion={cesarTrabajador.bind(null, trabajador.id)}
                  fechaHoy={fechaHoyEnLima()}
                  tareasAbiertas={trabajador.tareasAbiertas}
                  candidatos={(opciones?.supervisores ?? [])
                    .filter((persona) => persona.usuarioId !== trabajador.usuarioId)
                    .map((persona) => ({ id: persona.usuarioId, nombre: `${persona.nombres} ${persona.apellidos}` }))}
                />
              ) : (
                <FormularioConfirmacion
                  accion={reactivarTrabajador.bind(null, trabajador.id)}
                  etiquetaBoton="Reactivar trabajador"
                  textoPendiente="Reactivando…"
                  variante="primario"
                  pedirMotivo
                  consecuencia="El trabajador recupera el acceso. Sus clientes deben asignarse nuevamente."
                />
              )}
            </Tarjeta>
          ) : null}
        </div>
      </div>
    </>
  );
}
