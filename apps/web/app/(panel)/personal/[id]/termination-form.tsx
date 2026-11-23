'use client';

import { AreaTexto, Campo, Casilla, Seleccion } from '@sige/ui/components';
import { type ReactNode, useActionState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

interface PersonaOpcion {
  id: string;
  nombre: string;
}

interface PropiedadesFormularioBaja {
  accion: (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  fechaHoy: string;
  tareasAbiertas: number;
  candidatos: PersonaOpcion[];
}

export function FormularioBaja({ accion, fechaHoy, tareasAbiertas, candidatos }: PropiedadesFormularioBaja): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={accionFormulario} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <div className="max-w-xs">
        <Campo
          id="fechaCese"
          name="fechaCese"
          type="date"
          etiqueta="Fecha de cese"
          required
          defaultValue={estado.valores.fechaCese ?? fechaHoy}
          error={estado.errores.fechaCese}
        />
      </div>
      {tareasAbiertas > 0 ? (
        <Seleccion
          id="reasignarAId"
          name="reasignarAId"
          etiqueta="Reasignar sus tareas abiertas a"
          ayuda={`Tiene ${String(tareasAbiertas)} ${tareasAbiertas === 1 ? 'tarea abierta' : 'tareas abiertas'} como responsable o revisor. Quien las reciba debe estar asignado a los clientes de esas tareas.`}
          required
          defaultValue={estado.valores.reasignarAId ?? ''}
          error={estado.errores.reasignarAId}
        >
          <option value="" disabled>
            Seleccione
          </option>
          {candidatos.map((candidato) => (
            <option key={candidato.id} value={candidato.id}>
              {candidato.nombre}
            </option>
          ))}
        </Seleccion>
      ) : null}
      <AreaTexto
        id="motivo-baja"
        name="motivo"
        etiqueta="Motivo"
        ayuda="Quedará registrado en la auditoría."
        required
        minLength={5}
        maxLength={500}
        defaultValue={estado.valores.motivo}
        error={estado.errores.motivo}
      />
      <Casilla
        id="confirmacion-baja"
        name="confirmacion"
        value="si"
        required
        etiqueta="Confirmo la baja"
        descripcion="Se desactiva su cuenta, se cierran sus sesiones, se reasignan sus tareas abiertas y se retiran sus asignaciones a clientes. Su historial se conserva."
      />
      {estado.errores.confirmacion === undefined ? null : (
        <p className="text-sm font-medium text-rojo">{estado.errores.confirmacion}</p>
      )}
      <BotonEnvio variante="peligro" textoPendiente="Registrando…" className="self-start">
        Registrar baja
      </BotonEnvio>
    </form>
  );
}
