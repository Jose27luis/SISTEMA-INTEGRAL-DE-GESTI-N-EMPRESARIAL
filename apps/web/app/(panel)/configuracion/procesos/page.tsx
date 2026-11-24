import { esquemaListaEjecuciones } from '@sige/types';
import { Alerta, Insignia, Seleccion, Tarjeta, type TonoInsignia } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { formatearFechaHora } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';

export const metadata: Metadata = { title: 'Procesos automáticos · TORRES ASOCIADOS' };

const NOMBRES_PROCESO: Record<string, string> = {
  'alertas-de-tareas': 'Alertas de tareas',
  'generacion-de-obligaciones': 'Generación de obligaciones',
  'alertas-de-obligaciones': 'Alertas de obligaciones',
  'alertas-de-documentos': 'Alertas de documentos',
  'tareas-recurrentes': 'Tareas recurrentes',
  'revision-de-accesos': 'Revisión de accesos',
};

const TONOS: Record<'EN_CURSO' | 'CORRECTO' | 'ERROR', TonoInsignia> = {
  EN_CURSO: 'info',
  CORRECTO: 'exito',
  ERROR: 'peligro',
};

const ETIQUETAS_RESULTADO: Record<'EN_CURSO' | 'CORRECTO' | 'ERROR', string> = {
  EN_CURSO: 'En curso',
  CORRECTO: 'Correcto',
  ERROR: 'Error',
};

function nombreProceso(proceso: string): string {
  return NOMBRES_PROCESO[proceso] ?? proceso;
}

interface PropiedadesPaginaProcesos {
  searchParams: Promise<{ proceso?: string | string[]; resultado?: string | string[] }>;
}

export default async function PaginaProcesos({ searchParams }: PropiedadesPaginaProcesos): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'auditoria:ver')) {
    return <SinAcceso />;
  }

  const crudos = await searchParams;
  const proceso = (Array.isArray(crudos.proceso) ? crudos.proceso[0] : crudos.proceso) ?? '';
  const resultado = (Array.isArray(crudos.resultado) ? crudos.resultado[0] : crudos.resultado) ?? '';
  const consulta = new URLSearchParams({ proceso, resultado });
  const lista = await solicitarApi(`/procesos?${consulta.toString()}`, { esquema: esquemaListaEjecuciones });

  if (!lista.ok) {
    return <Alerta tono="error">{lista.error.mensaje}</Alerta>;
  }

  return (
    <>
      <EncabezadoPagina titulo="Procesos automáticos" descripcion="Ejecuciones del worker con su resultado y sus errores." />
      <div className="flex flex-col gap-6">
        <section aria-label="Estado de los procesos" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lista.datos.procesos.map(({ proceso: nombre, ultima, errores24h }) => (
            <div key={nombre} className="flex flex-col gap-1 rounded-lg border border-borde bg-superficie p-4">
              <p className="flex flex-wrap items-center justify-between gap-2 font-semibold text-marino">
                {nombreProceso(nombre)}
                <Insignia tono={TONOS[ultima.resultado]}>{ETIQUETAS_RESULTADO[ultima.resultado]}</Insignia>
              </p>
              <p className="text-xs text-apagado">
                Última: {formatearFechaHora(ultima.inicio)} · {ultima.registros} registros
              </p>
              <p className={errores24h > 0 ? 'text-xs font-semibold text-rojo' : 'text-xs text-apagado'}>
                {errores24h} {errores24h === 1 ? 'error' : 'errores'} en 24 horas
              </p>
            </div>
          ))}
        </section>
        <Tarjeta titulo="Ejecuciones">
          <form method="get" className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Seleccion id="proceso" name="proceso" etiqueta="Proceso" defaultValue={proceso}>
              <option value="">Todos</option>
              {lista.datos.procesos.map(({ proceso: nombre }) => (
                <option key={nombre} value={nombre}>
                  {nombreProceso(nombre)}
                </option>
              ))}
            </Seleccion>
            <Seleccion id="resultado" name="resultado" etiqueta="Resultado" defaultValue={resultado}>
              <option value="">Todos</option>
              <option value="CORRECTO">Correcto</option>
              <option value="ERROR">Error</option>
              <option value="EN_CURSO">En curso</option>
            </Seleccion>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-md bg-marino px-5 text-sm font-semibold text-white hover:bg-marino-medio"
              >
                Filtrar
              </button>
              <Link href="/configuracion/procesos" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-marino-claro hover:underline">
                Limpiar
              </Link>
            </div>
          </form>
          {lista.datos.ejecuciones.length === 0 ? (
            <p className="text-sm text-apagado">Sin ejecuciones con esos filtros.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borde">
              {lista.datos.ejecuciones.map((ejecucion) => (
                <li key={ejecucion.id} className="flex flex-col gap-1 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-tinta">{nombreProceso(ejecucion.proceso)}</span>
                    <Insignia tono={TONOS[ejecucion.resultado]}>{ETIQUETAS_RESULTADO[ejecucion.resultado]}</Insignia>
                  </div>
                  <p className="text-xs text-apagado">
                    {formatearFechaHora(ejecucion.inicio)}
                    {ejecucion.fin === null ? '' : ` → ${formatearFechaHora(ejecucion.fin)}`} · {ejecucion.registros} registros
                  </p>
                  {ejecucion.error === null ? null : <p className="text-xs break-words text-rojo">{ejecucion.error}</p>}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
