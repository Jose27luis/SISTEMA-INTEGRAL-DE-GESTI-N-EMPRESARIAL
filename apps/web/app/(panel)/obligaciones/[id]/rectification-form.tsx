'use client';

import { TAMANO_MAXIMO_CONSTANCIA_MB } from '@sige/types';
import { AreaTexto, Campo } from '@sige/ui/components';
import { type ReactNode, useActionState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

interface PropiedadesFormularioRectificacion {
  accion: (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  fechaHoy: string;
  fechaMinima: string;
}

export function FormularioRectificacion({ accion, fechaHoy, fechaMinima }: PropiedadesFormularioRectificacion): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={accionFormulario} key={estado.exito ? 'registrada' : 'rectificacion'} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <AreaTexto
        id="motivo-rectificacion"
        name="motivo"
        etiqueta="Motivo de la rectificación"
        required
        minLength={5}
        maxLength={1000}
        defaultValue={estado.exito ? '' : estado.valores.motivo}
        error={estado.errores.motivo}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id="fecha-rectificacion"
          name="fechaPresentacion"
          type="date"
          etiqueta="Fecha de presentación"
          required
          min={fechaMinima}
          max={fechaHoy}
          defaultValue={estado.exito ? fechaHoy : (estado.valores.fechaPresentacion ?? fechaHoy)}
          error={estado.errores.fechaPresentacion}
        />
        <Campo
          id="orden-rectificacion"
          name="numeroOrden"
          etiqueta="N.° de orden (opcional)"
          maxLength={40}
          defaultValue={estado.exito ? '' : estado.valores.numeroOrden}
          error={estado.errores.numeroOrden}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="constancia-rectificacion" className="text-sm font-semibold text-tinta">
          Constancia de la rectificación
        </label>
        <input
          id="constancia-rectificacion"
          name="constancia"
          type="file"
          required
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          className="block w-full text-sm text-apagado file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-marino/10 file:px-4 file:font-semibold file:text-marino hover:file:bg-marino/15"
        />
        <p className="text-sm text-apagado">PDF o imagen, hasta {TAMANO_MAXIMO_CONSTANCIA_MB} MB.</p>
        {estado.errores.constancia === undefined ? null : (
          <p className="text-sm font-medium text-rojo">{estado.errores.constancia}</p>
        )}
      </div>
      <BotonEnvio variante="secundario" textoPendiente="Registrando…" className="self-start">
        Registrar rectificación
      </BotonEnvio>
    </form>
  );
}
