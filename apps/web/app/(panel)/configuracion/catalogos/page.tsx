import {
  ETIQUETAS_CATALOGO,
  esquemaElementoCatalogo,
  esquemaTipoCatalogo,
  TIPOS_CATALOGO,
  type TipoCatalogo,
} from '@sige/types';
import { cn } from '@sige/ui/cn';
import { Alerta, Tarjeta } from '@sige/ui/components';
import { BriefcaseBusiness, Handshake, type LucideIcon, Network, Scale } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { cambiarEstadoElemento, crearElemento, renombrarElemento } from './actions';
import { FormularioNuevoElemento, ListaCatalogo } from './catalog-forms';

export const metadata: Metadata = { title: 'Catálogos · TORRES ASOCIADOS' };

const PRESENTACION: Record<TipoCatalogo, { icono: LucideIcon; uso: [string, string]; dondeSeUsa: string }> = {
  areas: { icono: Network, uso: ['ficha', 'fichas'], dondeSeUsa: 'Fichas del personal y reportes' },
  cargos: { icono: BriefcaseBusiness, uso: ['ficha', 'fichas'], dondeSeUsa: 'Fichas del personal' },
  'tipos-vinculo': { icono: Handshake, uso: ['ficha', 'fichas'], dondeSeUsa: 'Fichas del personal' },
  'regimenes-tributarios': { icono: Scale, uso: ['cliente', 'clientes'], dondeSeUsa: 'Fichas de clientes y obligaciones' },
};

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
  const listas = await Promise.all(
    TIPOS_CATALOGO.map((opcion) => solicitarApi(`/catalogos/${opcion}`, { esquema: esquemaElementoCatalogo.array() })),
  );
  const elementos = listas[TIPOS_CATALOGO.indexOf(tipo)];
  const presentacion = PRESENTACION[tipo];

  return (
    <>
      <EncabezadoPagina
        titulo="Catálogos"
        descripcion="Listas que alimentan los formularios del sistema. Lo que está en uso no se elimina: se desactiva y deja de ofrecerse."
      />

      <nav aria-label="Catálogos" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {TIPOS_CATALOGO.map((opcion, indice) => {
          const { icono: Icono, dondeSeUsa } = PRESENTACION[opcion];
          const lista = listas[indice];
          const total = lista?.ok === true ? lista.datos.length : 0;
          const activos = lista?.ok === true ? lista.datos.filter(({ activo }) => activo).length : 0;
          const actual = opcion === tipo;

          return (
            <Link
              key={opcion}
              href={`/configuracion/catalogos?tipo=${opcion}`}
              aria-current={actual ? 'page' : undefined}
              className={cn(
                'relative flex min-w-0 items-center gap-3 overflow-hidden rounded-lg border p-4 transition-all',
                actual
                  ? 'border-marino bg-marino text-white shadow-[0_10px_28px_rgb(1_41_93/0.25)]'
                  : 'border-borde bg-superficie text-tinta hover:-translate-y-0.5 hover:border-marino-claro hover:shadow-[0_8px_24px_rgb(1_41_93/0.10)]',
              )}
            >
              <span
                className={cn(
                  'flex size-12 shrink-0 items-center justify-center rounded-lg',
                  actual ? 'bg-white/15 text-dorado' : 'bg-marino/8 text-marino',
                )}
              >
                <Icono aria-hidden="true" className="size-6" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-base font-semibold">{ETIQUETAS_CATALOGO[opcion].plural}</span>
                <span className={cn('truncate text-xs', actual ? 'text-white/75' : 'text-apagado')}>{dondeSeUsa}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <span className="font-display text-2xl font-semibold tabular-nums">{activos}</span>
                <span className={cn('text-xs', actual ? 'text-white/75' : 'text-apagado')}>
                  {total === activos ? (activos === 1 ? 'activo' : 'activos') : `activos de ${String(total)}`}
                </span>
              </span>
              {actual ? <span className="absolute inset-x-0 bottom-0 h-1 bg-dorado" aria-hidden="true" /> : null}
            </Link>
          );
        })}
      </nav>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Tarjeta titulo={`${tipo === 'areas' ? 'Nueva' : 'Nuevo'} ${etiquetas.singular}`} className="lg:sticky lg:top-6">
          <FormularioNuevoElemento
            accion={crearElemento.bind(null, tipo)}
            singular={etiquetas.singular}
            descripcion={etiquetas.descripcion}
          />
        </Tarjeta>
        <Tarjeta titulo={etiquetas.plural} descripcion={`Se usan en: ${presentacion.dondeSeUsa}.`}>
          {elementos?.ok === true ? (
            <ListaCatalogo
              plural={etiquetas.plural}
              uso={presentacion.uso}
              elementos={elementos.datos.map((elemento) => ({
                ...elemento,
                renombrar: renombrarElemento.bind(null, tipo, elemento.id),
                cambiarEstado: cambiarEstadoElemento.bind(null, tipo, elemento.id, !elemento.activo),
              }))}
            />
          ) : (
            <Alerta tono="error">{elementos?.ok === false ? elementos.error.mensaje : 'No se pudo cargar el catálogo.'}</Alerta>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
