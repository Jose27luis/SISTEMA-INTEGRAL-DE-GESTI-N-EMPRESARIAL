'use client';

import type { CargaPersona } from '@sige/types';
import { cn } from '@sige/ui/cn';
import { Check } from 'lucide-react';
import { type ReactNode, useState } from 'react';

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter((parte) => parte !== '')
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('');
}

function sinTildes(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function nivelCarga(persona: CargaPersona): { etiqueta: string; clase: string } {
  if (persona.vencidas > 0) {
    return { etiqueta: 'Con atrasos', clase: 'bg-rojo-suave text-rojo' };
  }

  if (persona.abiertas >= 8) {
    return { etiqueta: 'Carga alta', clase: 'bg-dorado-suave text-dorado-oscuro' };
  }

  if (persona.abiertas === 0) {
    return { etiqueta: 'Libre', clase: 'bg-verde-suave text-verde-oscuro' };
  }

  return { etiqueta: 'Disponible', clase: 'bg-verde-suave text-verde-oscuro' };
}

interface PropiedadesSelectorEquipo {
  personas: readonly CargaPersona[];
  seleccionados: readonly string[];
  multiple: boolean;
  onCambiar: (ids: string[]) => void;
  error?: string | undefined;
}

export function SelectorEquipo({ personas, seleccionados, multiple, onCambiar, error }: PropiedadesSelectorEquipo): ReactNode {
  const [busqueda, setBusqueda] = useState('');
  const maximo = Math.max(8, ...personas.map(({ abiertas }) => abiertas));
  const filtro = sinTildes(busqueda.trim());
  const visibles = filtro === '' ? personas : personas.filter(({ nombre }) => sinTildes(nombre).includes(filtro));

  const alternar = (id: string): void => {
    if (!multiple) {
      onCambiar([id]);
      return;
    }

    onCambiar(seleccionados.includes(id) ? seleccionados.filter((actual) => actual !== id) : [...seleccionados, id]);
  };

  return (
    <div className="flex flex-col gap-3">
      {personas.length > 6 ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="buscar-persona" className="text-xs font-medium text-apagado">
            Buscar persona
          </label>
          <input
            id="buscar-persona"
            type="search"
            value={busqueda}
            onChange={(evento) => {
              setBusqueda(evento.target.value);
            }}
            className="h-11 rounded-md border border-borde bg-superficie px-3 text-sm text-tinta focus:border-marino-claro focus:outline-none"
          />
        </div>
      ) : null}

      <div
        role={multiple ? 'group' : 'radiogroup'}
        aria-label={multiple ? 'Responsables' : 'Responsable'}
        className="grid grid-cols-1 gap-2 @container sm:grid-cols-2 xl:grid-cols-3"
      >
        {visibles.map((persona) => {
          const elegido = seleccionados.includes(persona.id);
          const nivel = nivelCarga(persona);

          return (
            <button
              key={persona.id}
              type="button"
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={elegido}
              onClick={() => {
                alternar(persona.id);
              }}
              className={cn(
                'relative flex min-w-0 flex-col gap-2.5 rounded-lg border p-3 text-left transition-all',
                elegido
                  ? 'border-marino bg-marino/5 shadow-sm ring-2 ring-marino/20'
                  : 'border-borde bg-superficie hover:border-marino-claro hover:shadow-sm',
              )}
            >
              <span className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold',
                    elegido ? 'bg-marino text-superficie' : 'bg-fondo text-marino',
                  )}
                >
                  {elegido ? <Check className="size-5" strokeWidth={3} /> : iniciales(persona.nombre)}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-tinta">{persona.nombre}</span>
                  <span className={cn('self-start rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold', nivel.clase)}>
                    {nivel.etiqueta}
                  </span>
                </span>
              </span>
              <span
                aria-hidden="true"
                className="h-1.5 overflow-hidden rounded-full bg-borde"
              >
                <span
                  className={cn(
                    'block h-full rounded-full',
                    persona.vencidas > 0 ? 'bg-rojo' : persona.abiertas >= 8 ? 'bg-dorado' : 'bg-verde',
                  )}
                  style={{ width: `${String(Math.min(100, (persona.abiertas / maximo) * 100))}%` }}
                />
              </span>
              <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-apagado">
                <span>
                  <span className="font-semibold text-tinta tabular-nums">{persona.abiertas}</span> abiertas
                </span>
                {persona.vencidas > 0 ? (
                  <span className="font-semibold text-rojo">{persona.vencidas} vencidas</span>
                ) : null}
                {persona.porVencer > 0 ? (
                  <span className="text-dorado-oscuro">{persona.porVencer} por vencer</span>
                ) : null}
                {persona.urgentes > 0 ? <span>{persona.urgentes} urgentes</span> : null}
                {persona.porConfirmar > 0 ? <span>{persona.porConfirmar} sin confirmar</span> : null}
              </span>
            </button>
          );
        })}
        {visibles.length === 0 ? <p className="text-sm text-apagado">Nadie coincide con la búsqueda.</p> : null}
      </div>
      {error === undefined ? null : <p className="text-sm font-medium text-rojo">{error}</p>}
    </div>
  );
}

interface PropiedadesSelectorColaboradores {
  personas: readonly CargaPersona[];
  excluidos: readonly string[];
  seleccionados: readonly string[];
  onCambiar: (ids: string[]) => void;
  error?: string | undefined;
}

export function SelectorColaboradores({
  personas,
  excluidos,
  seleccionados,
  onCambiar,
  error,
}: PropiedadesSelectorColaboradores): ReactNode {
  const disponibles = personas.filter(({ id }) => !excluidos.includes(id));

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-tinta">Colaboradores</span>
      {disponibles.length === 0 ? (
        <p className="text-sm text-apagado">No hay más personas disponibles.</p>
      ) : (
        <div role="group" aria-label="Colaboradores" className="flex flex-wrap gap-2">
          {disponibles.map((persona) => {
            const elegido = seleccionados.includes(persona.id);

            return (
              <button
                key={persona.id}
                type="button"
                role="checkbox"
                aria-checked={elegido}
                onClick={() => {
                  onCambiar(elegido ? seleccionados.filter((id) => id !== persona.id) : [...seleccionados, persona.id]);
                }}
                className={cn(
                  'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors',
                  elegido
                    ? 'border-marino bg-marino text-superficie'
                    : 'border-borde bg-superficie text-tinta hover:border-marino-claro',
                )}
              >
                {elegido ? <Check aria-hidden="true" className="size-3.5" strokeWidth={3} /> : null}
                {persona.nombre}
              </button>
            );
          })}
        </div>
      )}
      <span className="text-xs text-apagado">Reciben el aviso y pueden registrar avances.</span>
      {error === undefined ? null : <p className="text-sm font-medium text-rojo">{error}</p>}
    </div>
  );
}
