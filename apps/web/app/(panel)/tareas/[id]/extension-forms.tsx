'use client';

import { cn } from '@sige/ui/cn';
import { AreaTexto, CampoFecha } from '@sige/ui/components';
import { type ReactNode, useActionState, useState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

type AccionFormulario = (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

export function BotonAcuse({ accion }: { accion: () => Promise<EstadoFormulario> }): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={accionFormulario} className="flex flex-col items-start gap-2">
      {estado.exito ? null : <MensajeFormulario estado={estado} />}
      <BotonEnvio textoPendiente="Confirmando…">Confirmar recepción</BotonEnvio>
    </form>
  );
}

interface PropiedadesFormularioProrroga {
  accion: AccionFormulario;
  fechaLimite: string;
}

function diaSiguiente(fecha: string): string {
  const dia = new Date(`${fecha}T12:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() + 1);
  return dia.toISOString().slice(0, 10);
}

export function FormularioProrroga({ accion, fechaLimite }: PropiedadesFormularioProrroga): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const [abierto, setAbierto] = useState(false);

  if (!abierto && !(estado.mensaje !== null && !estado.exito)) {
    return (
      <div className="flex flex-col items-start gap-2">
        {estado.exito ? <MensajeFormulario estado={estado} /> : null}
        <button
          type="button"
          onClick={() => {
            setAbierto(true);
          }}
          className="inline-flex min-h-11 items-center rounded-md border border-borde bg-superficie px-4 text-sm font-semibold text-marino hover:border-marino-claro"
        >
          Pedir más plazo
        </button>
      </div>
    );
  }

  return (
    <form action={accionFormulario} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <CampoFecha
        id="fecha-prorroga"
        name="fechaPropuesta"
        etiqueta="Nueva fecha límite"
        ayuda="Debe ser posterior a la fecha actual. Quien asignó la tarea la aprueba o la rechaza."
        min={diaSiguiente(fechaLimite)}
        required
        defaultValue={estado.exito ? undefined : estado.valores.fechaPropuesta}
        error={estado.errores.fechaPropuesta}
      />
      <AreaTexto
        id="motivo-prorroga"
        name="motivo"
        etiqueta="Motivo"
        ayuda="Explique qué impide cumplir la fecha actual."
        required
        minLength={10}
        maxLength={1000}
        rows={3}
        defaultValue={estado.exito ? undefined : estado.valores.motivo}
        error={estado.errores.motivo}
      />
      <div className="flex flex-wrap gap-2">
        <BotonEnvio textoPendiente="Enviando…">Enviar solicitud</BotonEnvio>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
          }}
          className="inline-flex min-h-11 items-center rounded-md px-4 text-sm font-semibold text-apagado hover:text-marino"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function FormularioResolucionProrroga({ accion }: { accion: AccionFormulario }): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const [decision, setDecision] = useState<'APROBAR' | 'RECHAZAR'>('APROBAR');

  return (
    <form action={accionFormulario} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium text-tinta">Decisión</legend>
        {(
          [
            { valor: 'APROBAR', titulo: 'Aprobar', detalle: 'La fecha límite cambia a la propuesta.' },
            { valor: 'RECHAZAR', titulo: 'Rechazar', detalle: 'Se mantiene la fecha actual.' },
          ] as const
        ).map((opcion) => (
          <label
            key={opcion.valor}
            className={cn(
              'flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-md border px-4 py-3 text-sm',
              decision === opcion.valor
                ? opcion.valor === 'APROBAR'
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
        id="respuesta-prorroga"
        name="respuesta"
        etiqueta={decision === 'RECHAZAR' ? 'Por qué se rechaza' : 'Comentario'}
        ayuda={decision === 'RECHAZAR' ? 'Obligatorio. El responsable lo verá en su aviso.' : 'Opcional.'}
        required={decision === 'RECHAZAR'}
        minLength={decision === 'RECHAZAR' ? 5 : undefined}
        maxLength={1000}
        rows={2}
        defaultValue={estado.exito ? undefined : estado.valores.respuesta}
        error={estado.errores.respuesta}
      />
      <BotonEnvio
        textoPendiente="Registrando…"
        variante={decision === 'APROBAR' ? 'primario' : 'peligro'}
        className="self-start"
      >
        {decision === 'APROBAR' ? 'Aprobar prórroga' : 'Rechazar prórroga'}
      </BotonEnvio>
    </form>
  );
}
