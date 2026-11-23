'use client';

import { AreaTexto, Campo, Casilla } from '@sige/ui/components';
import { type ReactNode, useActionState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

interface PropiedadesFormularioBaja {
  accion: (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  fechaHoy: string;
}

export function FormularioBaja({ accion, fechaHoy }: PropiedadesFormularioBaja): ReactNode {
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
        descripcion="Se desactiva su cuenta, se cierran sus sesiones y se retiran sus asignaciones a clientes. Su historial se conserva."
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
