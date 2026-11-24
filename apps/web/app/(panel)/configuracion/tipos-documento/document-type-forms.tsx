'use client';

import type { TipoDocumento } from '@sige/types';
import { Campo, Casilla, Insignia } from '@sige/ui/components';
import { type ReactNode, useActionState, useState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

type AccionFormulario = (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

export function FormularioTipoDocumento({ accion, tipo }: { accion: AccionFormulario; tipo?: TipoDocumento }): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const sufijo = tipo?.id ?? 'nuevo';
  const reiniciar = estado.exito && tipo === undefined;

  return (
    <form action={accionFormulario} key={reiniciar ? 'creado' : 'tipo'} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <Campo
        id={`nombre-${sufijo}`}
        name="nombre"
        etiqueta="Nombre"
        required
        maxLength={80}
        defaultValue={reiniciar ? '' : (estado.valores.nombre ?? tipo?.nombre ?? '')}
        error={estado.errores.nombre}
      />
      <Casilla
        id={`admiteVencimiento-${sufijo}`}
        name="admiteVencimiento"
        etiqueta="Admite fecha de vencimiento"
        descripcion="Para licencias, poderes, contratos y similares; se avisa antes de que venzan."
        defaultChecked={tipo?.admiteVencimiento ?? false}
      />
      <BotonEnvio textoPendiente="Guardando…" className="self-start">
        {tipo === undefined ? 'Crear tipo' : 'Guardar cambios'}
      </BotonEnvio>
    </form>
  );
}

export function FilaTipoDocumento({
  tipo,
  editar,
  cambiarActivo,
}: {
  tipo: TipoDocumento;
  editar: AccionFormulario;
  cambiarActivo: (anterior: EstadoFormulario) => Promise<EstadoFormulario>;
}): ReactNode {
  const [abierto, setAbierto] = useState(false);
  const [estado, accionActivo] = useActionState(cambiarActivo, ESTADO_INICIAL);

  return (
    <li className="flex flex-col gap-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-tinta">
            {tipo.nombre}
            {tipo.admiteVencimiento ? <Insignia tono="info">Con vencimiento</Insignia> : null}
            {tipo.activo ? null : <Insignia>Inactivo</Insignia>}
          </p>
          <p className="text-xs text-apagado">
            {tipo.documentos} {tipo.documentos === 1 ? 'documento' : 'documentos'}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              setAbierto(!abierto);
            }}
            aria-expanded={abierto}
            className="min-h-11 rounded-md px-3 text-sm font-semibold text-marino hover:bg-marino/5"
          >
            {abierto ? 'Cerrar' : 'Editar'}
          </button>
          <form action={accionActivo}>
            <button
              type="submit"
              className={
                tipo.activo
                  ? 'min-h-11 rounded-md px-3 text-sm font-semibold text-rojo hover:bg-rojo-suave'
                  : 'min-h-11 rounded-md px-3 text-sm font-semibold text-verde hover:bg-verde/10'
              }
            >
              {tipo.activo ? 'Desactivar' : 'Activar'}
            </button>
          </form>
        </div>
      </div>
      {estado.mensaje !== null && !estado.exito ? <MensajeFormulario estado={estado} /> : null}
      {abierto ? (
        <div className="rounded-md border border-borde p-4">
          <FormularioTipoDocumento accion={editar} tipo={tipo} />
        </div>
      ) : null}
    </li>
  );
}
