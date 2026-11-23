'use client';

import { AreaTexto, Casilla, type VarianteBoton } from '@sige/ui/components';
import { type ReactNode, useActionState, useId } from 'react';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';
import { MensajeFormulario } from './form-message';
import { BotonEnvio } from './submit-button';

interface PropiedadesFormularioConfirmacion {
  accion: (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  etiquetaBoton: string;
  textoPendiente: string;
  variante?: VarianteBoton;
  pedirMotivo?: boolean;
  ayudaMotivo?: string;
  consecuencia?: string;
  children?: ReactNode;
}

export function FormularioConfirmacion({
  accion,
  etiquetaBoton,
  textoPendiente,
  variante = 'secundario',
  pedirMotivo = false,
  ayudaMotivo,
  consecuencia,
  children,
}: PropiedadesFormularioConfirmacion): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const id = useId();

  return (
    <form action={accionFormulario} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      {children}
      {pedirMotivo ? (
        <AreaTexto
          id={`${id}-motivo`}
          name="motivo"
          etiqueta="Motivo"
          ayuda={ayudaMotivo ?? 'Quedará registrado en la auditoría. Mínimo 5 caracteres.'}
          minLength={5}
          maxLength={500}
          required
          defaultValue={estado.exito ? '' : estado.valores.motivo}
          error={estado.errores.motivo}
        />
      ) : null}
      {consecuencia === undefined ? null : (
        <Casilla
          id={`${id}-confirmacion`}
          name="confirmacion"
          value="si"
          required
          etiqueta="Confirmo la acción"
          descripcion={consecuencia}
        />
      )}
      {estado.errores.confirmacion === undefined ? null : (
        <p className="text-sm font-medium text-rojo">{estado.errores.confirmacion}</p>
      )}
      <BotonEnvio variante={variante} textoPendiente={textoPendiente} className="self-start">
        {etiquetaBoton}
      </BotonEnvio>
    </form>
  );
}
