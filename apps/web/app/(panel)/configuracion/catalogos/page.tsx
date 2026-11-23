import {
  ETIQUETAS_CATALOGO,
  esquemaElementoCatalogo,
  esquemaTipoCatalogo,
  TIPOS_CATALOGO,
  type TipoCatalogo,
} from '@sige/types';
import { cn } from '@sige/ui/cn';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { cambiarEstadoElemento, crearElemento, renombrarElemento } from './actions';
import { FilaCatalogo, FormularioNuevoElemento } from './catalog-forms';

export const metadata: Metadata = { title: 'Catálogos · TORRES ASOCIADOS' };

interface PropiedadesPaginaCatalogos {
  searchParams: Promise<{ tipo?: string | string[] }>;
}

export default async function PaginaCatalogos({ searchParams }: PropiedadesPaginaCatalogos): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'catalogo:gestionar')) {
    return <SinAcceso />;
  }

  const { tipo: tipoCrudo } = await searchParams;
  const tipoLeido = esquemaTipoCatalogo.safeParse(tipoCrudo);
  const tipo: TipoCatalogo = tipoLeido.success ? tipoLeido.data : 'areas';
  const etiquetas = ETIQUETAS_CATALOGO[tipo];
  const elementos = await solicitarApi(`/catalogos/${tipo}`, { esquema: esquemaElementoCatalogo.array() });

  return (
    <>
      <EncabezadoPagina
        titulo="Catálogos"
        descripcion="Listas que se usan en las fichas del personal y de los clientes. No se eliminan: se desactivan."
      />
      <nav aria-label="Catálogos" className="mb-6 flex flex-wrap gap-2">
        {TIPOS_CATALOGO.map((opcion) => (
          <Link
            key={opcion}
            href={`/configuracion/catalogos?tipo=${opcion}`}
            aria-current={opcion === tipo ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors',
              opcion === tipo
                ? 'border-marino bg-marino text-white'
                : 'border-borde bg-superficie text-marino hover:border-marino-claro',
            )}
          >
            {ETIQUETAS_CATALOGO[opcion].plural}
          </Link>
        ))}
      </nav>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Tarjeta titulo={`Nuevo ${etiquetas.singular}`} descripcion={etiquetas.descripcion}>
          <FormularioNuevoElemento accion={crearElemento.bind(null, tipo)} etiqueta="Nombre" />
        </Tarjeta>
        <Tarjeta titulo={etiquetas.plural}>
          {!elementos.ok ? (
            <Alerta tono="error">{elementos.error.mensaje}</Alerta>
          ) : elementos.datos.length === 0 ? (
            <p className="text-sm text-apagado">Todavía no hay elementos. Agregue el primero.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borde">
              {elementos.datos.map((elemento) => (
                <FilaCatalogo
                  key={elemento.id}
                  elemento={elemento}
                  renombrar={renombrarElemento.bind(null, tipo, elemento.id)}
                  cambiarEstado={cambiarEstadoElemento.bind(null, tipo, elemento.id, !elemento.activo)}
                />
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
