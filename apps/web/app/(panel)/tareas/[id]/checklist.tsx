'use client';

import type { TareaDetalle } from '@sige/types';
import { cn } from '@sige/ui/cn';
import { Campo } from '@sige/ui/components';
import { type ReactNode, useActionState, useRef } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';
import { formatearFechaHora } from '@/lib/format';

type Item = TareaDetalle['items'][number];

function FilaItem({
  item,
  editable,
  marcar,
}: {
  item: Item;
  editable: boolean;
  marcar: (anterior: EstadoFormulario) => Promise<EstadoFormulario>;
}): ReactNode {
  const [estado, accion] = useActionState(marcar, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);

  return (
    <li className="flex flex-col gap-1 py-2">
      <form ref={formulario} action={accion} className="flex items-start gap-3">
        <input
          id={`item-${item.id}`}
          type="checkbox"
          checked={item.completado}
          disabled={!editable}
          onChange={() => {
            formulario.current?.requestSubmit();
          }}
          className="mt-0.5 size-5 shrink-0 accent-verde"
        />
        <label htmlFor={`item-${item.id}`} className="flex flex-col">
          <span className={cn('text-sm text-tinta', item.completado && 'text-apagado line-through')}>{item.texto}</span>
          {item.completado && item.completadoEn !== null ? (
            <span className="text-xs text-apagado">
              {item.completadoPor ?? ''} · {formatearFechaHora(item.completadoEn)}
            </span>
          ) : null}
        </label>
      </form>
      {estado.mensaje !== null && !estado.exito ? <MensajeFormulario estado={estado} /> : null}
    </li>
  );
}

export function ListaVerificacion({
  items,
  editable,
  marcadores,
  agregar,
}: {
  items: Item[];
  editable: boolean;
  marcadores: Record<string, (anterior: EstadoFormulario) => Promise<EstadoFormulario>>;
  agregar: (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
}): ReactNode {
  const [estado, accion] = useActionState(agregar, ESTADO_INICIAL);
  const completados = items.filter(({ completado }) => completado).length;

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 ? (
        <p className="text-sm text-apagado">La tarea no tiene lista de verificación.</p>
      ) : (
        <>
          <p className="text-sm font-medium text-tinta">
            {completados} de {items.length} completados
          </p>
          <ul className="flex flex-col divide-y divide-borde">
            {items.flatMap((item) => {
              const marcar = marcadores[item.id];
              return marcar === undefined ? [] : [<FilaItem key={item.id} item={item} editable={editable} marcar={marcar} />];
            })}
          </ul>
        </>
      )}
      {editable ? (
        <form action={accion} key={estado.exito ? `agregado-${String(items.length)}` : 'item'} className="flex flex-col gap-3">
          {estado.mensaje !== null && !estado.exito ? <MensajeFormulario estado={estado} /> : null}
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <Campo
                id="nuevo-item"
                name="texto"
                etiqueta="Agregar paso"
                maxLength={200}
                required
                defaultValue={estado.exito ? '' : estado.valores.texto}
                error={estado.errores.texto}
              />
            </div>
            <BotonEnvio variante="secundario" textoPendiente="Agregando…">
              Agregar
            </BotonEnvio>
          </div>
        </form>
      ) : null}
    </div>
  );
}
