'use client';

import { Campo } from '@sige/ui/components';
import { type ReactNode, useActionState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

interface PropiedadesFormularioGeneracion {
  accion: (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  periodo: string;
}

export function FormularioGeneracion({ accion, periodo }: PropiedadesFormularioGeneracion): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={accionFormulario} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Campo
            id="periodo"
            name="periodo"
            type="month"
            etiqueta="Periodo tributario"
            required
            defaultValue={estado.valores.periodo ?? periodo}
            error={estado.errores.periodo}
          />
        </div>
        <BotonEnvio textoPendiente="Generando…">Generar obligaciones</BotonEnvio>
      </div>
      <p className="text-sm text-apagado">
        Crea las obligaciones que falten con la fecha del cronograma según el último dígito del RUC y una tarea para cada
        responsable. Las ya generadas no se duplican. El sistema lo hace solo cada día con el periodo anterior.
      </p>
    </form>
  );
}
