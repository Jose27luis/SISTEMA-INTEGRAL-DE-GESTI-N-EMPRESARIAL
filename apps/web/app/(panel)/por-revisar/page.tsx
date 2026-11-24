import { esquemaPaginaTareas } from '@sige/types';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { VistaLista } from '../tareas/task-views';

export const metadata: Metadata = { title: 'Por revisar · TORRES ASOCIADOS' };

export default async function PaginaPorRevisar(): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'tarea:revisar')) {
    return <SinAcceso />;
  }

  const consulta = new URLSearchParams({ estado: 'EN_REVISION', porPagina: '100' });
  const otras = new URLSearchParams(consulta);
  consulta.set('revisorId', perfil.usuario.id);

  const [propias, todas] = await Promise.all([
    solicitarApi(`/tareas?${consulta.toString()}`, { esquema: esquemaPaginaTareas }),
    perfil.alcanceGlobal
      ? solicitarApi(`/tareas?${otras.toString()}`, { esquema: esquemaPaginaTareas })
      : Promise.resolve(null),
  ]);
  const ajenas =
    todas?.ok === true ? todas.datos.elementos.filter((tarea) => tarea.responsable.id !== perfil.usuario.id) : [];
  const idsPropias = new Set(propias.ok ? propias.datos.elementos.map(({ id }) => id) : []);
  const otrasEnRevision = ajenas.filter(({ id }) => !idsPropias.has(id));

  return (
    <>
      <EncabezadoPagina
        titulo="Por revisar"
        descripcion="Trabajos terminados que esperan su aprobación u observación, del más antiguo al más reciente."
      />
      <div className="flex flex-col gap-6">
        {!propias.ok ? (
          <Alerta tono="error">{propias.error.mensaje}</Alerta>
        ) : (
          <Tarjeta titulo={`Asignadas a usted (${String(propias.datos.total)})`}>
            {propias.datos.elementos.length === 0 ? (
              <p className="text-sm text-apagado">No tiene trabajos pendientes de revisión.</p>
            ) : (
              <VistaLista tareas={propias.datos.elementos} />
            )}
          </Tarjeta>
        )}
        {perfil.alcanceGlobal && otrasEnRevision.length > 0 ? (
          <Tarjeta
            titulo={`Otras tareas en revisión (${String(otrasEnRevision.length)})`}
            descripcion="Con alcance global también puede revisarlas si el revisor asignado no está disponible."
          >
            <VistaLista tareas={otrasEnRevision} />
          </Tarjeta>
        ) : null}
      </div>
    </>
  );
}
