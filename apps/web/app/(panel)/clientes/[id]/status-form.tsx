'use client';

import { ESTADOS_CLIENTE, type EstadoCliente, ETIQUETAS_ESTADO_CLIENTE } from '@sige/types';
import { AreaTexto, Casilla, Seleccion } from '@sige/ui/components';
import { type ReactNode, useActionState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

interface PropiedadesFormularioEstado {
  accion: (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  estadoActual: EstadoCliente;
}

export function FormularioEstadoCliente({ accion, estadoActual }: PropiedadesFormularioEstado): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const opciones = ESTADOS_CLIENTE.filter((opcion) => opcion !== estadoActual);

  return (
    <form action={accionFormulario} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <Seleccion
        id="estado"
        name="estado"
        etiqueta="Nuevo estado"
        defaultValue={estado.valores.estado ?? opciones[0]}
        error={estado.errores.estado}
      >
        {opciones.map((opcion) => (
          <option key={opcion} value={opcion}>
            {ETIQUETAS_ESTADO_CLIENTE[opcion]}
          </option>
        ))}
      </Seleccion>
      <AreaTexto
        id="motivo-estado"
        name="motivo"
        etiqueta="Motivo"
        ayuda="Quedará registrado en el historial del cliente."
        required
        minLength={5}
        maxLength={500}
        defaultValue={estado.exito ? '' : estado.valores.motivo}
        error={estado.errores.motivo}
      />
      <Casilla
        id="confirmacion-estado"
        name="confirmacion"
        value="si"
        required
        etiqueta="Confirmo el cambio de estado"
        descripcion="Un cliente inactivo conserva su expediente completo y puede reactivarse."
      />
      {estado.errores.confirmacion === undefined ? null : (
        <p className="text-sm font-medium text-rojo">{estado.errores.confirmacion}</p>
      )}
      <BotonEnvio variante="secundario" textoPendiente="Guardando…" className="self-start">
        Cambiar estado
      </BotonEnvio>
    </form>
  );
}
