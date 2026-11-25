import {
  ESTADOS_PROYECTO,
  ETIQUETAS_ESTADO_PROYECTO,
  esquemaFiltroProyectos,
  esquemaOpcionesProyecto,
  esquemaPaginaProyectos,
} from '@sige/types';
import { Alerta, Campo, Seleccion, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { Paginacion } from '@/components/pagination';
import { BarraAvance, EstadoProyectoInsignia } from '@/components/project-status';
import { solicitarApi } from '@/lib/api';
import { formatearFecha } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';

export const metadata: Metadata = { title: 'Proyectos · TORRES ASOCIADOS' };

type ParametrosBusqueda = Record<string, string | string[] | undefined>;

const CAMPOS_FILTRO = ['busqueda', 'clienteId', 'responsableId', 'estado', 'dificultades'] as const;

function primerValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? '';
}

export default async function PaginaProyectos({ searchParams }: { searchParams: Promise<ParametrosBusqueda> }): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'proyecto:ver')) {
    return <SinAcceso />;
  }

  const crudos = await searchParams;
  const valores = Object.fromEntries(CAMPOS_FILTRO.map((campo) => [campo, primerValor(crudos[campo]).trim()])) as Record<
    (typeof CAMPOS_FILTRO)[number],
    string
  >;
  const pagina = Math.max(1, Number(primerValor(crudos.pagina)) || 1);
  const consulta = new URLSearchParams();

  for (const campo of CAMPOS_FILTRO) {
    if (valores[campo] !== '') {
      consulta.set(campo, valores[campo]);
    }
  }

  const consultaApi = new URLSearchParams(consulta);
  consultaApi.set('pagina', String(pagina));
  const filtro = esquemaFiltroProyectos.safeParse(Object.fromEntries(consultaApi));
  const [proyectos, opciones] = await Promise.all([
    filtro.success ? solicitarApi(`/proyectos?${consultaApi.toString()}`, { esquema: esquemaPaginaProyectos }) : Promise.resolve(null),
    solicitarApi('/proyectos/opciones', { esquema: esquemaOpcionesProyecto }),
  ]);

  return (
    <>
      <EncabezadoPagina
        titulo="Proyectos"
        descripcion={
          perfil.alcanceGlobal ? 'Todos los proyectos del estudio.' : 'Proyectos en los que participa o de sus clientes asignados.'
        }
        acciones={
          opciones.ok && opciones.datos.puedeCrear ? (
            <Link
              href="/proyectos/nuevo"
              className="inline-flex min-h-11 items-center rounded-md bg-marino px-4 text-sm font-semibold text-white hover:bg-marino-medio"
            >
              Nuevo proyecto
            </Link>
          ) : null
        }
      />
      <div className="flex flex-col gap-6">
        <Tarjeta>
          <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_2fr_1fr_auto] lg:items-end">
            <Campo id="busqueda" name="busqueda" etiqueta="Nombre o código" defaultValue={valores.busqueda} maxLength={100} />
            <Seleccion id="clienteId" name="clienteId" etiqueta="Cliente" defaultValue={valores.clienteId}>
              <option value="">Todos</option>
              {opciones.ok
                ? opciones.datos.clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre}
                    </option>
                  ))
                : null}
            </Seleccion>
            <Seleccion id="responsableId" name="responsableId" etiqueta="Responsable" defaultValue={valores.responsableId}>
              <option value="">Todos</option>
              {opciones.ok
                ? opciones.datos.usuarios.map((usuario) => (
                    <option key={usuario.id} value={usuario.id}>
                      {usuario.nombre}
                    </option>
                  ))
                : null}
            </Seleccion>
            <Seleccion id="estado" name="estado" etiqueta="Estado" defaultValue={valores.estado}>
              <option value="">Todos</option>
              {ESTADOS_PROYECTO.map((estado) => (
                <option key={estado} value={estado}>
                  {ETIQUETAS_ESTADO_PROYECTO[estado]}
                </option>
              ))}
            </Seleccion>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-1">
              <label className="inline-flex min-h-11 items-center gap-2 text-sm text-tinta">
                <input type="checkbox" name="dificultades" value="si" defaultChecked={valores.dificultades === 'si'} className="size-4" />
                Con dificultades
              </label>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-md bg-marino px-5 text-sm font-semibold text-white hover:bg-marino-medio"
              >
                Filtrar
              </button>
              <Link href="/proyectos" className="text-sm font-semibold text-marino-claro hover:underline">
                Limpiar
              </Link>
            </div>
          </form>
        </Tarjeta>

        {proyectos === null ? (
          <Alerta tono="error">Los filtros no son válidos.</Alerta>
        ) : proyectos.ok ? (
          <Tarjeta titulo={`${String(proyectos.datos.total)} ${proyectos.datos.total === 1 ? 'proyecto' : 'proyectos'}`}>
            {proyectos.datos.elementos.length === 0 ? (
              <p className="text-sm text-apagado">No hay proyectos con estos filtros.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-borde">
                {proyectos.datos.elementos.map((proyecto) => (
                  <li key={proyecto.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <Link href={`/proyectos/${proyecto.id}`} className="font-semibold text-marino hover:underline">
                        {proyecto.codigo} · {proyecto.nombre}
                      </Link>
                      <p className="text-xs text-apagado">
                        {proyecto.cliente?.razonSocial ?? 'Proyecto interno'} · {proyecto.responsable.nombre} · entrega{' '}
                        {formatearFecha(proyecto.fechaEntrega)} · {proyecto.tareas} {proyecto.tareas === 1 ? 'tarea' : 'tareas'}
                      </p>
                      {proyecto.conDificultades && proyecto.detalleDificultad !== null ? (
                        <p className="mt-1 text-xs text-rojo">{proyecto.detalleDificultad}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <EstadoProyectoInsignia
                        estado={proyecto.estado}
                        atrasado={proyecto.atrasado}
                        conDificultades={proyecto.conDificultades}
                      />
                      <BarraAvance avance={proyecto.avance} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Paginacion
              ruta="/proyectos"
              consulta={consulta}
              pagina={pagina}
              total={proyectos.datos.total}
              porPagina={proyectos.datos.porPagina}
            />
          </Tarjeta>
        ) : (
          <Alerta tono="error">{proyectos.error.mensaje}</Alerta>
        )}
      </div>
    </>
  );
}
