'use client';

import { cn } from '@sige/ui/cn';
import { AreaTexto } from '@sige/ui/components';
import { type ReactNode, useActionState, useState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

type AccionFormulario = (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

interface PropiedadesFormularioEnvio {
  accion: AccionFormulario;
  requiereAprobacion: boolean;
  esCorreccion: boolean;
  faltaEvidencia: string | null;
}

export function FormularioEnvio({
  accion,
  requiereAprobacion,
  esCorreccion,
  faltaEvidencia,
}: PropiedadesFormularioEnvio): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={accionFormulario} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <p className="text-sm text-apagado">
        {requiereAprobacion
          ? 'La tarea pasará a revisión y el revisor recibirá un aviso. Terminar no equivale a aprobar.'
          : 'La tarea no requiere aprobación: quedará finalizada.'}
      </p>
      {faltaEvidencia === null ? null : (
        <p className="rounded-md bg-rojo-suave px-3 py-2 text-sm text-rojo">
          Falta adjuntar la evidencia requerida ({faltaEvidencia}). Regístrela en un avance antes de enviar.
        </p>
      )}
      <AreaTexto
        id="comentario-envio"
        name="comentario"
        etiqueta={esCorreccion ? 'Qué se corrigió' : 'Comentario para el revisor'}
        rows={2}
        maxLength={1000}
        defaultValue={estado.exito ? undefined : estado.valores.comentario}
        error={estado.errores.comentario}
      />
      {estado.errores.evidencias === undefined ? null : (
        <p className="text-sm font-medium text-rojo">{estado.errores.evidencias}</p>
      )}
      <BotonEnvio textoPendiente="Enviando…" className="self-start">
        {esCorreccion ? 'Reenviar a revisión' : requiereAprobacion ? 'Terminar y enviar a revisión' : 'Terminar tarea'}
      </BotonEnvio>
    </form>
  );
}

export function FormularioRevision({ accion }: { accion: AccionFormulario }): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const [decision, setDecision] = useState<'APROBADA' | 'OBSERVADA'>('APROBADA');

  return (
    <form action={accionFormulario} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium text-tinta">Decisión</legend>
        {(
          [
            { valor: 'APROBADA', titulo: 'Aprobar', detalle: 'El trabajo cumple lo pedido.' },
            { valor: 'OBSERVADA', titulo: 'Observar', detalle: 'Vuelve al responsable para corregir.' },
          ] as const
        ).map((opcion) => (
          <label
            key={opcion.valor}
            className={cn(
              'flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-md border px-4 py-3 text-sm',
              decision === opcion.valor
                ? opcion.valor === 'APROBADA'
                  ? 'border-verde bg-verde-suave'
                  : 'border-rojo bg-rojo-suave'
                : 'border-borde hover:border-marino-claro',
            )}
          >
            <span className="flex items-center gap-2 font-semibold text-tinta">
              <input
                type="radio"
                name="decision"
                value={opcion.valor}
                checked={decision === opcion.valor}
                onChange={() => {
                  setDecision(opcion.valor);
                }}
                className="size-4 accent-marino"
              />
              {opcion.titulo}
            </span>
            <span className="pl-6 text-apagado">{opcion.detalle}</span>
          </label>
        ))}
      </fieldset>
      <AreaTexto
        id="comentario-revision"
        name="comentario"
        etiqueta={decision === 'OBSERVADA' ? 'Qué debe corregirse' : 'Comentario'}
        ayuda={decision === 'OBSERVADA' ? 'Obligatorio. El responsable lo verá en su notificación.' : 'Opcional.'}
        required={decision === 'OBSERVADA'}
        minLength={decision === 'OBSERVADA' ? 5 : undefined}
        rows={3}
        maxLength={2000}
        defaultValue={estado.exito ? undefined : estado.valores.comentario}
        error={estado.errores.comentario}
      />
      <BotonEnvio
        textoPendiente="Registrando…"
        variante={decision === 'APROBADA' ? 'primario' : 'peligro'}
        className="self-start"
      >
        {decision === 'APROBADA' ? 'Aprobar trabajo' : 'Observar trabajo'}
      </BotonEnvio>
    </form>
  );
}
