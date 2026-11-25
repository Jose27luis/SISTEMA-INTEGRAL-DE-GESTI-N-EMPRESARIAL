'use client';

import type { ElementoCatalogo } from '@sige/types';
import { cn } from '@sige/ui/cn';
import { Campo, Insignia } from '@sige/ui/components';
import { Check, Pencil, Power, Search, X } from 'lucide-react';
import { type ReactNode, useActionState, useEffect, useMemo, useState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

type AccionFormulario = (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

type AccionSinDatos = (anterior: EstadoFormulario) => Promise<EstadoFormulario>;

export interface ElementoConAcciones extends ElementoCatalogo {
  renombrar: AccionFormulario;
  cambiarEstado: AccionSinDatos;
}

type Filtro = 'todos' | 'activos' | 'desactivados';

const ETIQUETAS_FILTRO: Record<Filtro, string> = {
  todos: 'Todos',
  activos: 'Activos',
  desactivados: 'Desactivados',
};

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function FormularioNuevoElemento({
  accion,
  singular,
  descripcion,
}: {
  accion: AccionFormulario;
  singular: string;
  descripcion: string;
}): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={accionFormulario} key={estado.exito ? (estado.mensaje ?? 'agregado') : 'nuevo'} className="flex flex-col gap-4">
      <p className="text-sm text-apagado">{descripcion}</p>
      <MensajeFormulario estado={estado} />
      <Campo
        id="nuevo-nombre"
        name="nombre"
        etiqueta="Nombre"
        required
        maxLength={80}
        autoComplete="off"
        defaultValue={estado.exito ? '' : estado.valores.nombre}
        error={estado.errores.nombre}
      />
      <BotonEnvio textoPendiente="Agregando…" className="w-full">
        {`Agregar ${singular}`}
      </BotonEnvio>
    </form>
  );
}

function TarjetaElemento({ elemento, uso }: { elemento: ElementoConAcciones; uso: [string, string] }): ReactNode {
  const [editando, setEditando] = useState(false);
  const [estadoNombre, accionNombre] = useActionState(elemento.renombrar, ESTADO_INICIAL);
  const [estadoCambio, accionCambio] = useActionState(elemento.cambiarEstado, ESTADO_INICIAL);

  useEffect(() => {
    if (estadoNombre.exito) {
      setEditando(false);
    }
  }, [estadoNombre]);

  return (
    <li
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-lg border p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgb(1_41_93/0.10)]',
        elemento.activo ? 'border-borde bg-superficie hover:border-marino-claro' : 'border-dashed border-borde bg-fondo',
      )}
    >
      {editando ? (
        <form action={accionNombre} className="flex flex-col gap-3">
          <Campo
            id={`nombre-${elemento.id}`}
            name="nombre"
            etiqueta="Nuevo nombre"
            required
            maxLength={80}
            autoComplete="off"
            defaultValue={estadoNombre.valores.nombre ?? elemento.nombre}
            error={estadoNombre.errores.nombre}
          />
          <div className="flex gap-2">
            <BotonEnvio textoPendiente="Guardando…" className="flex-1">
              Guardar
            </BotonEnvio>
            <button
              type="button"
              onClick={() => {
                setEditando(false);
              }}
              aria-label="Cancelar"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-borde px-3 text-apagado hover:bg-fondo"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className={cn('text-base font-semibold break-words', elemento.activo ? 'text-tinta' : 'text-apagado')}>
              {elemento.nombre}
            </p>
            <Insignia tono={elemento.activo ? 'exito' : 'neutro'}>{elemento.activo ? 'Activo' : 'Desactivado'}</Insignia>
          </div>
          <p className="text-sm text-apagado">
            {elemento.enUso === 0
              ? 'Todavía sin uso'
              : `En uso en ${String(elemento.enUso)} ${elemento.enUso === 1 ? uso[0] : uso[1]}`}
          </p>
          <div className="mt-auto flex gap-2 border-t border-borde pt-3">
            <button
              type="button"
              onClick={() => {
                setEditando(true);
              }}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md text-sm font-semibold text-marino hover:bg-marino/5"
            >
              <Pencil aria-hidden="true" className="size-4" />
              Renombrar
            </button>
            <form action={accionCambio} className="flex-1">
              <button
                type="submit"
                className={cn(
                  'inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold',
                  elemento.activo ? 'text-rojo hover:bg-rojo-suave' : 'text-verde hover:bg-verde-suave',
                )}
              >
                {elemento.activo ? <Power aria-hidden="true" className="size-4" /> : <Check aria-hidden="true" className="size-4" />}
                {elemento.activo ? 'Desactivar' : 'Activar'}
              </button>
            </form>
          </div>
        </>
      )}
      {estadoCambio.mensaje !== null && !estadoCambio.exito ? <MensajeFormulario estado={estadoCambio} /> : null}
    </li>
  );
}

export function ListaCatalogo({
  elementos,
  plural,
  uso,
}: {
  elementos: ElementoConAcciones[];
  plural: string;
  uso: [string, string];
}): ReactNode {
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const activos = elementos.filter(({ activo }) => activo).length;
  const conteos: Record<Filtro, number> = {
    todos: elementos.length,
    activos,
    desactivados: elementos.length - activos,
  };
  const visibles = useMemo(() => {
    const termino = normalizar(busqueda.trim());
    return elementos.filter(
      (elemento) =>
        (filtro === 'todos' || (filtro === 'activos') === elemento.activo) &&
        (termino === '' || normalizar(elemento.nombre).includes(termino)),
    );
  }, [elementos, busqueda, filtro]);

  if (elementos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-borde bg-fondo px-6 py-16 text-center">
        <p className="text-lg font-semibold text-marino">{`Todavía no hay ${plural.toLowerCase()}`}</p>
        <p className="max-w-md text-sm text-apagado">
          Agregue el primero con el formulario. Aparecerá aquí y en los formularios que lo usan.
        </p>
      </div>
    );
  }

  return (
    <div className="@container flex flex-col gap-4">
      <div className="flex flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:justify-between">
        <div className="relative w-full @2xl:max-w-sm">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-apagado" />
          <input
            type="search"
            value={busqueda}
            onChange={(evento) => {
              setBusqueda(evento.target.value);
            }}
            aria-label={`Buscar en ${plural.toLowerCase()}`}
            className="h-11 w-full rounded-md border border-borde bg-superficie pr-3 pl-9 text-sm text-tinta focus:border-marino-claro focus:outline-none focus-visible:ring-2 focus-visible:ring-marino-claro/30"
          />
        </div>
        <div role="group" aria-label="Mostrar" className="inline-flex max-w-full flex-wrap self-start rounded-lg border border-borde bg-fondo p-1">
          {(['todos', 'activos', 'desactivados'] as const).map((opcion) => (
            <button
              key={opcion}
              type="button"
              aria-pressed={filtro === opcion}
              onClick={() => {
                setFiltro(opcion);
              }}
              className={cn(
                'inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors',
                filtro === opcion ? 'bg-superficie text-marino shadow-sm' : 'text-apagado hover:text-marino',
              )}
            >
              {ETIQUETAS_FILTRO[opcion]}
              <span className="rounded-full bg-marino/8 px-2 text-xs tabular-nums">{conteos[opcion]}</span>
            </button>
          ))}
        </div>
      </div>
      {visibles.length === 0 ? (
        <p className="rounded-lg border border-dashed border-borde px-4 py-10 text-center text-sm text-apagado">
          Ningún elemento coincide con la búsqueda.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 @lg:grid-cols-2 @4xl:grid-cols-3 @6xl:grid-cols-4">
          {visibles.map((elemento) => (
            <TarjetaElemento key={elemento.id} elemento={elemento} uso={uso} />
          ))}
        </ul>
      )}
    </div>
  );
}
