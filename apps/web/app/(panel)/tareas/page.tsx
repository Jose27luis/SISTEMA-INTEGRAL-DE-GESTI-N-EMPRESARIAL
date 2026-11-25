import {
  ESTADOS_TAREA,
  ETIQUETAS_ESTADO_TAREA,
  ETIQUETAS_PRIORIDAD,
  esquemaFiltroTareas,
  esquemaOpcionesTarea,
  esquemaPaginaTareas,
  PRIORIDADES,
} from '@sige/types';
import { cn } from '@sige/ui/cn';
import { Alerta, Campo, Seleccion, Tarjeta } from '@sige/ui/components';
import { CalendarDays, Columns3, List } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { fechaHoyEnLima } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { VistaCalendario, VistaLista, VistaTablero } from './task-views';

export const metadata: Metadata = { title: 'Tareas · TORRES ASOCIADOS' };

type ParametrosBusqueda = Record<string, string | string[] | undefined>;

const VISTAS = [
  { clave: 'lista', etiqueta: 'Lista', icono: List },
  { clave: 'tablero', etiqueta: 'Tablero', icono: Columns3 },
  { clave: 'calendario', etiqueta: 'Calendario', icono: CalendarDays },
] as const;

type Vista = (typeof VISTAS)[number]['clave'];

const CAMPOS_FILTRO = ['busqueda', 'estado', 'responsableId', 'clienteId', 'prioridad', 'atrasadas'] as const;

const NOMBRES_MES = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function primerValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? '';
}

function desplazarMes(mes: string, cantidad: number): string {
  const [anio, numero] = mes.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio ?? 2000, (numero ?? 1) - 1 + cantidad, 1));
  return fecha.toISOString().slice(0, 7);
}

function ultimoDia(mes: string): string {
  const [anio, numero] = mes.split('-').map(Number);
  return new Date(Date.UTC(anio ?? 2000, numero ?? 1, 0)).toISOString().slice(0, 10);
}

interface PropiedadesPaginaTareas {
  searchParams: Promise<ParametrosBusqueda>;
}

export default async function PaginaTareas({ searchParams }: PropiedadesPaginaTareas): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'tarea:ver')) {
    return <SinAcceso />;
  }

  const crudos = await searchParams;
  const vistaCruda = primerValor(crudos.vista);
  const vista: Vista = vistaCruda === 'tablero' || vistaCruda === 'calendario' ? vistaCruda : 'lista';
  const hoy = fechaHoyEnLima();
  const mesCrudo = primerValor(crudos.mes);
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/u.test(mesCrudo) ? mesCrudo : hoy.slice(0, 7);
  const valores: Record<(typeof CAMPOS_FILTRO)[number], string> = {
    busqueda: primerValor(crudos.busqueda).trim(),
    estado: primerValor(crudos.estado),
    responsableId: primerValor(crudos.responsableId),
    clienteId: primerValor(crudos.clienteId),
    prioridad: primerValor(crudos.prioridad),
    atrasadas: primerValor(crudos.atrasadas),
  };
  const pagina = Number(primerValor(crudos.pagina)) || 1;

  const consulta = new URLSearchParams();

  for (const campo of CAMPOS_FILTRO) {
    if (valores[campo] !== '') {
      consulta.set(campo, valores[campo]);
    }
  }

  const enlace = (cambios: Record<string, string>): string => {
    const destino = new URLSearchParams(consulta);
    destino.set('vista', vista);

    if (vista === 'calendario') {
      destino.set('mes', mes);
    }

    for (const [clave, valor] of Object.entries(cambios)) {
      destino.set(clave, valor);
    }

    return `/tareas?${destino.toString()}`;
  };

  const consultaApi = new URLSearchParams(consulta);

  if (vista === 'tablero') {
    consultaApi.set('estado', valores.estado === '' ? 'ABIERTAS' : valores.estado);
    consultaApi.set('porPagina', '500');
  } else if (vista === 'calendario') {
    consultaApi.set('desde', `${mes}-01`);
    consultaApi.set('hasta', ultimoDia(mes));
    consultaApi.set('porPagina', '500');
  } else {
    consultaApi.set('pagina', String(pagina));
  }

  const filtro = esquemaFiltroTareas.safeParse(Object.fromEntries(consultaApi));
  const [tareas, opciones] = await Promise.all([
    filtro.success
      ? solicitarApi(`/tareas?${consultaApi.toString()}`, { esquema: esquemaPaginaTareas })
      : Promise.resolve(null),
    solicitarApi('/tareas/opciones', { esquema: esquemaOpcionesTarea }),
  ]);
  const asignadas = Number.parseInt(primerValor(crudos.asignadas), 10) || 0;
  const totalPaginas =
    tareas?.ok === true ? Math.max(1, Math.ceil(tareas.datos.total / tareas.datos.porPagina)) : 1;

  return (
    <>
      <EncabezadoPagina
        titulo="Tareas"
        descripcion={
          perfil.alcanceGlobal
            ? 'Todas las tareas de la empresa.'
            : 'Tareas en las que participa y las de sus clientes asignados.'
        }
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
      <div className="flex flex-col gap-6">
        {asignadas > 1 ? (
          <Alerta tono="exito" titulo={`Se asignaron ${String(asignadas)} tareas`}>
            Cada responsable recibió su propia tarea y el aviso para confirmar la recepción.
          </Alerta>
        ) : null}
        <Tarjeta>
          <form method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="vista" value={vista} />
            {vista === 'calendario' ? <input type="hidden" name="mes" value={mes} /> : null}
            <div className="sm:col-span-2">
              <Campo
                id="busqueda"
                name="busqueda"
                type="search"
                etiqueta="Buscar"
                ayuda="Título o código de la tarea."
                maxLength={100}
                defaultValue={valores.busqueda}
              />
            </div>
            <Seleccion id="estado" name="estado" etiqueta="Estado" defaultValue={valores.estado}>
              <option value="">{vista === 'tablero' ? 'Abiertas' : 'Todos'}</option>
              <option value="ABIERTAS">Abiertas</option>
              <option value="CERRADAS">Cerradas</option>
              {ESTADOS_TAREA.map((estado) => (
                <option key={estado} value={estado}>
                  {ETIQUETAS_ESTADO_TAREA[estado]}
                </option>
              ))}
            </Seleccion>
            <Seleccion id="prioridad" name="prioridad" etiqueta="Prioridad" defaultValue={valores.prioridad}>
              <option value="">Todas</option>
              {PRIORIDADES.map((prioridad) => (
                <option key={prioridad} value={prioridad}>
                  {ETIQUETAS_PRIORIDAD[prioridad]}
                </option>
              ))}
            </Seleccion>
            <Seleccion
              id="responsableId"
              name="responsableId"
              etiqueta="Responsable"
              defaultValue={valores.responsableId}
            >
              <option value="">Todos</option>
              {opciones.ok
                ? opciones.datos.usuarios.map((usuario) => (
                    <option key={usuario.id} value={usuario.id}>
                      {usuario.nombre}
                    </option>
                  ))
                : null}
            </Seleccion>
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
            <Seleccion id="atrasadas" name="atrasadas" etiqueta="Plazo" defaultValue={valores.atrasadas}>
              <option value="">Cualquiera</option>
              <option value="si">Solo atrasadas</option>
            </Seleccion>
            <div className="flex items-start gap-2 sm:mt-7">
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-marino px-5 text-sm font-semibold text-white hover:bg-marino-medio"
              >
                Filtrar
              </button>
              <Link
                href={`/tareas?vista=${vista}`}
                className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-marino-claro hover:underline"
              >
                Limpiar
              </Link>
            </div>
          </form>
        </Tarjeta>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Vistas" className="inline-flex rounded-md border border-borde bg-superficie p-1">
            {VISTAS.map(({ clave, etiqueta, icono: Icono }) => (
              <Link
                key={clave}
                href={`/tareas?${new URLSearchParams({ ...Object.fromEntries(consulta), vista: clave }).toString()}`}
                aria-current={vista === clave ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-9 items-center gap-2 rounded px-3 text-sm font-semibold',
                  vista === clave ? 'bg-marino text-white' : 'text-marino hover:bg-marino/5',
                )}
              >
                <Icono aria-hidden="true" className="size-4" />
                {etiqueta}
              </Link>
            ))}
          </nav>
          {vista === 'calendario' ? (
            <div className="flex items-center gap-3 text-sm">
              <Link href={enlace({ mes: desplazarMes(mes, -1) })} className="font-semibold text-marino-claro hover:underline">
                ← Anterior
              </Link>
              <span className="min-w-36 text-center font-semibold text-marino capitalize">
                {NOMBRES_MES.format(new Date(`${mes}-01T00:00:00Z`))}
              </span>
              <Link href={enlace({ mes: desplazarMes(mes, 1) })} className="font-semibold text-marino-claro hover:underline">
                Siguiente →
              </Link>
            </div>
          ) : null}
        </div>

        {tareas === null ? (
          <Alerta tono="error">Los filtros no son válidos.</Alerta>
        ) : !tareas.ok ? (
          <Alerta tono="error">{tareas.error.mensaje}</Alerta>
        ) : vista === 'calendario' ? (
          <VistaCalendario tareas={tareas.datos.elementos} mes={mes} hoy={hoy} />
        ) : tareas.datos.elementos.length === 0 ? (
          <Tarjeta>
            <p className="text-sm text-apagado">
              {consulta.size === 0 ? 'Todavía no hay tareas registradas.' : 'No se encontraron tareas con esos filtros.'}
            </p>
          </Tarjeta>
        ) : vista === 'tablero' ? (
          <VistaTablero tareas={tareas.datos.elementos} />
        ) : (
          <Tarjeta titulo={`${String(tareas.datos.total)} ${tareas.datos.total === 1 ? 'tarea' : 'tareas'}`}>
            <VistaLista tareas={tareas.datos.elementos} />
            {totalPaginas > 1 ? (
              <nav aria-label="Paginación" className="mt-4 flex items-center justify-between gap-3 text-sm">
                {pagina > 1 ? (
                  <Link href={enlace({ pagina: String(pagina - 1) })} className="font-semibold text-marino-claro hover:underline">
                    ← Anteriores
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-apagado">
                  Página {pagina} de {totalPaginas}
                </span>
                {pagina < totalPaginas ? (
                  <Link href={enlace({ pagina: String(pagina + 1) })} className="font-semibold text-marino-claro hover:underline">
                    Siguientes →
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </Tarjeta>
        )}
      </div>
    </>
  );
}
