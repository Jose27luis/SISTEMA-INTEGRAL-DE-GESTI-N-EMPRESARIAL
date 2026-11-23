'use client';

import { AreaTexto, Casilla } from '@sige/ui/components';
import { type ReactNode, useActionState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

interface PropiedadesFormularioComentario {
  accion: (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  participantes: { id: string; nombre: string }[];
}

export function FormularioComentario({ accion, participantes }: PropiedadesFormularioComentario): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={accionFormulario} className="flex flex-col gap-3">
      <MensajeFormulario estado={estado} />
      <AreaTexto
        id="contenido"
        name="contenido"
        etiqueta="Nuevo comentario"
        required
        rows={3}
        maxLength={2000}
        defaultValue={estado.exito ? undefined : estado.valores.contenido}
        error={estado.errores.contenido}
      />
      {participantes.length === 0 ? null : (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-tinta">Mencionar y notificar a</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {participantes.map((participante) => (
              <Casilla
                key={participante.id}
                id={`mencion-${participante.id}`}
                name="mencionadoIds"
                value={participante.id}
                etiqueta={participante.nombre}
              />
            ))}
          </div>
          {estado.errores.mencionadoIds === undefined ? null : (
            <p className="text-sm font-medium text-rojo">{estado.errores.mencionadoIds}</p>
          )}
        </fieldset>
      )}
      <BotonEnvio textoPendiente="Publicando…" variante="secundario" className="self-start">
        Comentar
      </BotonEnvio>
    </form>
  );
}
