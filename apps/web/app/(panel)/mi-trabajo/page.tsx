import { esquemaMiTrabajo, type TareaResumen } from '@sige/types';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { TarjetaTarea } from '@/components/task-card';
import { solicitarApi } from '@/lib/api';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';

export const metadata: Metadata = { title: 'Mi trabajo · TORRES ASOCIADOS' };

interface PropiedadesGrupo {
  titulo: string;
  descripcion: string;
  tareas: TareaResumen[];
  tono?: 'alerta';
}

function GrupoTareas({ titulo, descripcion, tareas, tono }: PropiedadesGrupo): ReactNode {
  if (tareas.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby={`grupo-${titulo}`} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id={`grupo-${titulo}`}
          className={tono === 'alerta' ? 'text-lg font-semibold text-rojo' : 'text-lg font-semibold text-marino'}
        >
          {titulo} <span className="text-sm font-medium text-apagado">({tareas.length})</span>
        </h2>
        <p className="text-sm text-apagado">{descripcion}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tareas.map((tarea) => (
          <TarjetaTarea key={tarea.id} tarea={tarea} />
        ))}
      </div>
    </section>
  );
}

export default async function PaginaMiTrabajo(): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'tarea:ver')) {
    return <SinAcceso />;
  }

  const resultado = await solicitarApi('/tareas/mi-trabajo', { esquema: esquemaMiTrabajo });

  return (
    <>
      <EncabezadoPagina
        titulo="Mi trabajo"
        descripcion="Tareas abiertas en las que es responsable o colaborador, ordenadas por urgencia."
        acciones={
          tienePermiso(perfil, 'tarea:crear') ? (
            <Link
              href="/tareas/nueva"
              className="inline-flex min-h-11 items-center rounded-md bg-marino px-4 text-sm font-semibold text-white hover:bg-marino-medio"
            >
              Nueva tarea
            </Link>
          ) : null
        }
      />
      {!resultado.ok ? (
        <Alerta tono="error">{resultado.error.mensaje}</Alerta>
      ) : (
        <div className="flex flex-col gap-8">
          {resultado.datos.porRevisar > 0 ? (
            <Alerta tono="aviso" titulo="Pendientes de su revisión">
              Tiene {resultado.datos.porRevisar}{' '}
              {resultado.datos.porRevisar === 1 ? 'tarea esperando' : 'tareas esperando'} su aprobación.{' '}
              <Link href="/tareas?estado=EN_REVISION" className="font-semibold underline">
                Revisarlas
              </Link>
            </Alerta>
          ) : null}
          {resultado.datos.atrasadas.length +
            resultado.datos.hoy.length +
            resultado.datos.proximas.length +
            resultado.datos.posteriores.length ===
          0 ? (
            <Tarjeta>
              <p className="text-sm text-apagado">No tiene tareas abiertas. Cuando le asignen una, aparecerá aquí.</p>
            </Tarjeta>
          ) : (
            <>
              <GrupoTareas
                titulo="Atrasadas"
                descripcion="Pasaron su fecha límite."
                tareas={resultado.datos.atrasadas}
                tono="alerta"
              />
              <GrupoTareas titulo="Para hoy" descripcion="Vencen hoy." tareas={resultado.datos.hoy} />
              <GrupoTareas
                titulo="Próximos 7 días"
                descripcion="Planifique su semana."
                tareas={resultado.datos.proximas}
              />
              <GrupoTareas titulo="Más adelante" descripcion="Con plazo holgado." tareas={resultado.datos.posteriores} />
            </>
          )}
        </div>
      )}
    </>
  );
}
