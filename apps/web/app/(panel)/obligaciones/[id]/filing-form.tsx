'use client';

import { TAMANO_MAXIMO_CONSTANCIA_MB } from '@sige/types';
import { AreaTexto, Campo } from '@sige/ui/components';
import { Paperclip } from 'lucide-react';
import { type ReactNode, useActionState, useState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';
import { formatearTamano } from '@/lib/format';

const FORMATOS_ACEPTADOS = '.pdf,.png,.jpg,.jpeg,.webp';
const LIMITE_BYTES = TAMANO_MAXIMO_CONSTANCIA_MB * 1024 * 1024;

interface PropiedadesFormularioPresentacion {
  accion: (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  fechaHoy: string;
  periodo: string;
  esCorreccion: boolean;
}

export function FormularioPresentacion({
  accion,
  fechaHoy,
  periodo,
  esCorreccion,
}: PropiedadesFormularioPresentacion): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const [archivo, setArchivo] = useState<{ nombre: string; tamano: number } | null>(null);
  const excede = archivo !== null && archivo.tamano > LIMITE_BYTES;

  if (estado.exito) {
    return <MensajeFormulario estado={estado} />;
  }

  return (
    <form action={accionFormulario} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id="fechaPresentacion"
          name="fechaPresentacion"
          type="date"
          etiqueta="Fecha de presentación"
          required
          min={`${periodo}-01`}
          max={fechaHoy}
          defaultValue={estado.valores.fechaPresentacion ?? fechaHoy}
          error={estado.errores.fechaPresentacion}
        />
        <Campo
          id="numeroOrden"
          name="numeroOrden"
          etiqueta="N.° de orden (opcional)"
          maxLength={40}
          defaultValue={estado.valores.numeroOrden}
          error={estado.errores.numeroOrden}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="constancia" className="text-sm font-semibold text-tinta">
          Constancia de presentación
        </label>
        <input
          id="constancia"
          name="constancia"
          type="file"
          required
          accept={FORMATOS_ACEPTADOS}
          aria-describedby="constancia-ayuda"
          onChange={(evento) => {
            const elegido = evento.target.files?.[0];
            setArchivo(elegido === undefined ? null : { nombre: elegido.name, tamano: elegido.size });
          }}
          className="block w-full text-sm text-apagado file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-marino/10 file:px-4 file:font-semibold file:text-marino hover:file:bg-marino/15"
        />
        <p id="constancia-ayuda" className="text-sm text-apagado">
          PDF o imagen, hasta {TAMANO_MAXIMO_CONSTANCIA_MB} MB. Sin constancia no se puede marcar como presentada.
        </p>
        {archivo === null ? null : (
          <p className={excede ? 'flex items-center gap-2 text-sm text-rojo' : 'flex items-center gap-2 text-sm text-tinta'}>
            <Paperclip aria-hidden="true" className="size-4" />
            {archivo.nombre} · {formatearTamano(archivo.tamano)}
          </p>
        )}
        {estado.errores.constancia === undefined ? null : (
          <p className="text-sm font-medium text-rojo">{estado.errores.constancia}</p>
        )}
      </div>
      <AreaTexto
        id="observaciones"
        name="observaciones"
        etiqueta="Observaciones (opcional)"
        maxLength={1000}
        defaultValue={estado.valores.observaciones}
        error={estado.errores.observaciones}
      />
      <BotonEnvio textoPendiente="Registrando…" className="self-start">
        {esCorreccion ? 'Registrar corrección y reenviar' : 'Registrar presentación'}
      </BotonEnvio>
    </form>
  );
}
