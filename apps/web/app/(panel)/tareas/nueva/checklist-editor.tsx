'use client';

import { MAXIMO_ITEMS_VERIFICACION } from '@sige/types';
import { cn } from '@sige/ui/cn';
import { ArrowDown, ArrowUp, GripVertical, Plus, X } from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useState } from 'react';

interface PropiedadesEditorLista {
  items: string[];
  onCambiar: (items: string[]) => void;
  error?: string | undefined;
}

function mover(lista: string[], desde: number, hasta: number): string[] {
  const copia = [...lista];
  const [item] = copia.splice(desde, 1);

  if (item !== undefined) {
    copia.splice(hasta, 0, item);
  }

  return copia;
}

export function EditorListaVerificacion({ items, onCambiar, error }: PropiedadesEditorLista): ReactNode {
  const [nuevo, setNuevo] = useState('');
  const [arrastrado, setArrastrado] = useState<number | null>(null);
  const [destino, setDestino] = useState<number | null>(null);
  const lleno = items.length >= MAXIMO_ITEMS_VERIFICACION;

  const agregar = (): void => {
    const texto = nuevo.trim();

    if (texto.length < 2 || lleno) {
      return;
    }

    onCambiar([...items, texto]);
    setNuevo('');
  };

  const alPresionar = (evento: KeyboardEvent<HTMLInputElement>): void => {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      agregar();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-tinta">Lista de verificación</span>
        <span className="text-xs text-apagado tabular-nums">
          {items.length} de {MAXIMO_ITEMS_VERIFICACION}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-borde px-4 py-3 text-sm text-apagado">
          Opcional. Divida el trabajo en pasos que el responsable irá marcando; con seguimiento estricto deben quedar
          todos marcados antes de enviar a revisión.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {items.map((item, indice) => (
            <li
              key={`${item}-${String(indice)}`}
              draggable
              onDragStart={(evento) => {
                setArrastrado(indice);
                evento.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(evento) => {
                evento.preventDefault();
                setDestino(indice);
              }}
              onDragLeave={() => {
                setDestino((actual) => (actual === indice ? null : actual));
              }}
              onDrop={(evento) => {
                evento.preventDefault();

                if (arrastrado !== null && arrastrado !== indice) {
                  onCambiar(mover(items, arrastrado, indice));
                }

                setArrastrado(null);
                setDestino(null);
              }}
              onDragEnd={() => {
                setArrastrado(null);
                setDestino(null);
              }}
              className={cn(
                'group flex items-center gap-2 rounded-md border bg-superficie py-1.5 pr-1.5 pl-1 text-sm transition-colors',
                arrastrado === indice ? 'border-marino-claro opacity-50' : 'border-borde',
                destino === indice && arrastrado !== indice && 'border-marino bg-marino/5',
              )}
            >
              <GripVertical aria-hidden="true" className="size-4 shrink-0 cursor-grab text-apagado" />
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-fondo text-xs font-semibold text-marino tabular-nums">
                {indice + 1}
              </span>
              <span className="min-w-0 flex-1 break-words text-tinta">{item}</span>
              <span className="flex shrink-0 items-center">
                <button
                  type="button"
                  aria-label={`Subir «${item}»`}
                  disabled={indice === 0}
                  onClick={() => {
                    onCambiar(mover(items, indice, indice - 1));
                  }}
                  className="grid size-8 place-items-center rounded text-apagado hover:bg-fondo hover:text-marino disabled:opacity-30"
                >
                  <ArrowUp aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Bajar «${item}»`}
                  disabled={indice === items.length - 1}
                  onClick={() => {
                    onCambiar(mover(items, indice, indice + 1));
                  }}
                  className="grid size-8 place-items-center rounded text-apagado hover:bg-fondo hover:text-marino disabled:opacity-30"
                >
                  <ArrowDown aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Quitar «${item}»`}
                  onClick={() => {
                    onCambiar(items.filter((_, posicion) => posicion !== indice));
                  }}
                  className="grid size-8 place-items-center rounded text-apagado hover:bg-rojo-suave hover:text-rojo"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nuevo-paso" className="text-xs font-medium text-apagado">
          Nuevo paso
        </label>
        <div className="flex gap-2">
          <input
            id="nuevo-paso"
            type="text"
            value={nuevo}
            maxLength={200}
            disabled={lleno}
            onChange={(evento) => {
              setNuevo(evento.target.value);
            }}
            onKeyDown={alPresionar}
            className="h-11 min-w-0 flex-1 rounded-md border border-borde bg-superficie px-3 text-sm text-tinta focus:border-marino-claro focus:outline-none disabled:bg-fondo"
          />
          <button
            type="button"
            onClick={agregar}
            disabled={nuevo.trim().length < 2 || lleno}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-borde bg-superficie px-3 text-sm font-semibold text-marino hover:border-marino-claro disabled:opacity-40"
          >
            <Plus aria-hidden="true" className="size-4" />
            Agregar
          </button>
        </div>
        <span className="text-xs text-apagado">Enter agrega el paso. Arrastre o use las flechas para ordenar.</span>
      </div>

      {error === undefined ? null : <p className="text-sm font-medium text-rojo">{error}</p>}
    </div>
  );
}
