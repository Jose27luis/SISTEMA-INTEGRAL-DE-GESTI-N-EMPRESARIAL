import { esquemaFiltroDocumentos, esquemaOpcionesDocumentos, esquemaPaginaDocumentos } from '@sige/types';
import { Alerta, Campo, Seleccion, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ListaDocumentos } from '@/components/document-list';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';

export const metadata: Metadata = { title: 'Documentos · TORRES ASOCIADOS' };

type ParametrosBusqueda = Record<string, string | string[] | undefined>;

const CAMPOS_FILTRO = [
  'busqueda',
  'clienteId',
  'tipoDocumentoId',
  'periodo',
  'desde',
  'hasta',
  'vencimiento',
  'archivados',
] as const;

function primerValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? '';
}

interface PropiedadesPaginaDocumentos {
  searchParams: Promise<ParametrosBusqueda>;
}

export default async function PaginaDocumentos({ searchParams }: PropiedadesPaginaDocumentos): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'documento:ver')) {
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
  const filtro = esquemaFiltroDocumentos.safeParse(Object.fromEntries(consultaApi));
  const [documentos, opciones] = await Promise.all([
    filtro.success
      ? solicitarApi(`/documentos?${consultaApi.toString()}`, { esquema: esquemaPaginaDocumentos })
      : Promise.resolve(null),
    solicitarApi('/documentos/opciones', { esquema: esquemaOpcionesDocumentos }),
  ]);
  const totalPaginas =
    documentos?.ok === true ? Math.max(1, Math.ceil(documentos.datos.total / documentos.datos.porPagina)) : 1;
  const enlacePagina = (numero: number): string => {
    const destino = new URLSearchParams(consulta);
    destino.set('pagina', String(numero));
    return `/documentos?${destino.toString()}`;
  };

  return (
    <>
      <EncabezadoPagina
        titulo="Documentos"
        descripcion={
          perfil.alcanceGlobal
            ? 'Todos los documentos de la empresa y de los clientes.'
            : 'Documentos de sus clientes asignados y los que usted subió.'
        }
        acciones={
          tienePermiso(perfil, 'documento:gestionar') ? (
            <Link
              href="/documentos/nuevo"
              className="inline-flex min-h-11 items-center rounded-md bg-marino px-4 text-sm font-semibold text-white hover:bg-marino-medio"
            >
              Subir documento
            </Link>
          ) : null
        }
      />
      <div className="flex flex-col gap-6">
        <Tarjeta>
          <form method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <Campo
                id="busqueda"
                name="busqueda"
                type="search"
                etiqueta="Buscar"
                ayuda="Por título del documento."
                maxLength={100}
                defaultValue={valores.busqueda}
              />
            </div>
            <Seleccion id="clienteId" name="clienteId" etiqueta="Cliente" defaultValue={valores.clienteId}>
              <option value="">Todos</option>
              {opciones.ok
                ? opciones.datos.clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.razonSocial}
                    </option>
                  ))
                : null}
            </Seleccion>
            <Seleccion id="tipoDocumentoId" name="tipoDocumentoId" etiqueta="Tipo" defaultValue={valores.tipoDocumentoId}>
              <option value="">Todos</option>
              {opciones.ok
                ? opciones.datos.tipos.map((tipo) => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.nombre}
                    </option>
                  ))
                : null}
            </Seleccion>
            <Campo id="periodo" name="periodo" type="month" etiqueta="Periodo" defaultValue={valores.periodo} />
            <Campo id="desde" name="desde" type="date" etiqueta="Subido desde" defaultValue={valores.desde} />
            <Campo id="hasta" name="hasta" type="date" etiqueta="Subido hasta" defaultValue={valores.hasta} />
            <Seleccion id="vencimiento" name="vencimiento" etiqueta="Vencimiento" defaultValue={valores.vencimiento}>
              <option value="">Cualquiera</option>
              <option value="por-vencer">Vencen en 30 días</option>
              <option value="vencidos">Vencidos</option>
            </Seleccion>
            <Seleccion id="archivados" name="archivados" etiqueta="Mostrar" defaultValue={valores.archivados}>
              <option value="">Vigentes</option>
              <option value="si">Archivados</option>
            </Seleccion>
            <div className="flex items-start gap-2 sm:mt-7">
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-marino px-5 text-sm font-semibold text-white hover:bg-marino-medio"
              >
                Buscar
              </button>
              <Link
                href="/documentos"
                className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-marino-claro hover:underline"
              >
                Limpiar
              </Link>
            </div>
          </form>
        </Tarjeta>

        {documentos === null ? (
          <Alerta tono="error">Los filtros no son válidos. Revise las fechas.</Alerta>
        ) : documentos.ok ? (
          <Tarjeta titulo={`${String(documentos.datos.total)} ${documentos.datos.total === 1 ? 'documento' : 'documentos'}`}>
            <ListaDocumentos documentos={documentos.datos.elementos} mostrarCliente vacio="No hay documentos con estos filtros." />
            {totalPaginas > 1 ? (
              <nav aria-label="Páginas" className="mt-4 flex items-center justify-between text-sm">
                {pagina > 1 ? (
                  <Link href={enlacePagina(pagina - 1)} className="font-semibold text-marino-claro hover:underline">
                    ← Anterior
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-apagado">
                  Página {pagina} de {totalPaginas}
                </span>
                {pagina < totalPaginas ? (
                  <Link href={enlacePagina(pagina + 1)} className="font-semibold text-marino-claro hover:underline">
                    Siguiente →
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </Tarjeta>
        ) : (
          <Alerta tono="error">{documentos.error.mensaje}</Alerta>
        )}
      </div>
    </>
  );
}
