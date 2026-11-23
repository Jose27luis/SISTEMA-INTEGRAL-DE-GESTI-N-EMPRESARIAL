import { ESTADOS_CLIENTE, ETIQUETAS_ESTADO_CLIENTE, esquemaFiltroClientes, esquemaPaginaClientes } from '@sige/types';
import { Alerta, Campo, Seleccion, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { EstadoClienteInsignia } from '@/components/client-status';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';

export const metadata: Metadata = { title: 'Clientes · TORRES ASOCIADOS' };

type ParametrosBusqueda = Record<string, string | string[] | undefined>;

function primerValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? '';
}

function aConsulta(busqueda: string, estado: string, pagina: number): string {
  const consulta = new URLSearchParams();

  if (busqueda !== '') {
    consulta.set('busqueda', busqueda);
  }

  if (estado !== '') {
    consulta.set('estado', estado);
  }

  consulta.set('pagina', String(pagina));
  return consulta.toString();
}

interface PropiedadesPaginaClientes {
  searchParams: Promise<ParametrosBusqueda>;
}

export default async function PaginaClientes({ searchParams }: PropiedadesPaginaClientes): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'cliente:ver')) {
    return <SinAcceso />;
  }

  const crudos = await searchParams;
  const busqueda = primerValor(crudos.busqueda).trim();
  const estado = primerValor(crudos.estado);
  const filtro = esquemaFiltroClientes.safeParse({ busqueda, estado, pagina: primerValor(crudos.pagina) || '1' });
  const pagina = filtro.success ? filtro.data.pagina : 1;
  const clientes = filtro.success
    ? await solicitarApi(`/clientes?${aConsulta(busqueda, estado, pagina)}`, { esquema: esquemaPaginaClientes })
    : null;
  const puedeGestionar = tienePermiso(perfil, 'cliente:gestionar');
  const totalPaginas =
    clientes?.ok === true ? Math.max(1, Math.ceil(clientes.datos.total / clientes.datos.porPagina)) : 1;

  return (
    <>
      <EncabezadoPagina
        titulo="Clientes"
        descripcion={
          perfil.alcanceGlobal ? 'Todos los clientes de la empresa.' : 'Clientes que tiene asignados.'
        }
        acciones={
          puedeGestionar ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/clientes/importar"
                className="inline-flex min-h-11 items-center rounded-md border border-borde bg-superficie px-4 text-sm font-semibold text-marino hover:border-marino-claro"
              >
                Importar desde Excel
              </Link>
              <Link
                href="/clientes/nuevo"
                className="inline-flex min-h-11 items-center rounded-md bg-marino px-4 text-sm font-semibold text-white hover:bg-marino-medio"
              >
                Nuevo cliente
              </Link>
            </div>
          ) : null
        }
      />
      <div className="flex flex-col gap-6">
        <Tarjeta>
          <form method="get" className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
            <Campo
              id="busqueda"
              name="busqueda"
              type="search"
              etiqueta="Buscar"
              ayuda="Razón social, nombres, RUC o DNI."
              maxLength={100}
              defaultValue={busqueda}
            />
            <Seleccion id="estado" name="estado" etiqueta="Estado" defaultValue={estado}>
              <option value="">Todos</option>
              {ESTADOS_CLIENTE.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {ETIQUETAS_ESTADO_CLIENTE[opcion]}
                </option>
              ))}
            </Seleccion>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center self-start rounded-md bg-marino px-5 text-sm font-semibold text-white hover:bg-marino-medio sm:mt-7"
            >
              Buscar
            </button>
          </form>
        </Tarjeta>

        {clientes === null ? (
          <Alerta tono="error">Los filtros no son válidos.</Alerta>
        ) : !clientes.ok ? (
          <Alerta tono="error">{clientes.error.mensaje}</Alerta>
        ) : clientes.datos.elementos.length === 0 ? (
          <Tarjeta>
            <p className="text-sm text-apagado">
              {busqueda === '' && estado === ''
                ? 'Todavía no hay clientes registrados.'
                : 'No se encontraron clientes con esos filtros.'}
            </p>
          </Tarjeta>
        ) : (
          <Tarjeta titulo={`${String(clientes.datos.total)} ${clientes.datos.total === 1 ? 'cliente' : 'clientes'}`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead className="border-b border-borde text-xs tracking-wide text-apagado uppercase">
                  <tr>
                    <th scope="col" className="py-3 pr-4 font-semibold">Cliente</th>
                    <th scope="col" className="py-3 pr-4 font-semibold">Régimen</th>
                    <th scope="col" className="py-3 pr-4 font-semibold">Responsable</th>
                    <th scope="col" className="py-3 pr-4 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borde">
                  {clientes.datos.elementos.map((cliente) => (
                    <tr key={cliente.id}>
                      <td className="py-3 pr-4">
                        <Link href={`/clientes/${cliente.id}`} className="font-semibold text-marino hover:underline">
                          {cliente.razonSocial}
                        </Link>
                        <p className="text-xs text-apagado">
                          {cliente.ruc === null ? `DNI ${cliente.dni ?? ''}` : `RUC ${cliente.ruc}`}
                          {cliente.contactoPrincipal === null ? '' : ` · ${cliente.contactoPrincipal}`}
                        </p>
                      </td>
                      <td className="py-3 pr-4">{cliente.regimenTributario?.nombre ?? 'Sin definir'}</td>
                      <td className="py-3 pr-4">{cliente.responsable?.nombre ?? 'Sin responsable'}</td>
                      <td className="py-3 pr-4">
                        <EstadoClienteInsignia estado={cliente.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPaginas > 1 ? (
              <nav aria-label="Paginación" className="mt-4 flex items-center justify-between gap-3 text-sm">
                {pagina > 1 ? (
                  <Link
                    href={`/clientes?${aConsulta(busqueda, estado, pagina - 1)}`}
                    className="font-semibold text-marino-claro hover:underline"
                  >
                    ← Anteriores
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-apagado">
                  Página {pagina} de {totalPaginas}
                </span>
                {pagina < totalPaginas ? (
                  <Link
                    href={`/clientes?${aConsulta(busqueda, estado, pagina + 1)}`}
                    className="font-semibold text-marino-claro hover:underline"
                  >
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
