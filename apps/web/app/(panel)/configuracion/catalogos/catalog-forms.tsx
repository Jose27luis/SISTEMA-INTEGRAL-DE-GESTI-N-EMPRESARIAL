'use client';

import type { ElementoCatalogo } from '@sige/types';
import { Campo, Insignia } from '@sige/ui/components';
import { type ReactNode, useActionState, useEffect, useState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

type AccionFormulario = (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

interface PropiedadesNuevoElemento {
  accion: AccionFormulario;
  etiqueta: string;
}

export function FormularioNuevoElemento({ accion, etiqueta }: PropiedadesNuevoElemento): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={accionFormulario} className="flex flex-col gap-3">
      <MensajeFormulario estado={estado} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <Campo
            id="nuevo-nombre"
            name="nombre"
            etiqueta={etiqueta}
            required
            maxLength={80}
            defaultValue={estado.exito ? '' : estado.valores.nombre}
            error={estado.errores.nombre}
          />
        </div>
        <BotonEnvio textoPendiente="Agregando…" className="sm:mt-7">
          Agregar
        </BotonEnvio>
      </div>
    </form>
  );
}

interface PropiedadesFilaCatalogo {
  elemento: ElementoCatalogo;
  renombrar: AccionFormulario;
  cambiarEstado: (anterior: EstadoFormulario) => Promise<EstadoFormulario>;
}

export function FilaCatalogo({ elemento, renombrar, cambiarEstado }: PropiedadesFilaCatalogo): ReactNode {
  const [editando, setEditando] = useState(false);
  const [estadoNombre, accionNombre] = useActionState(renombrar, ESTADO_INICIAL);
  const [estadoCambio, accionCambio] = useActionState(cambiarEstado, ESTADO_INICIAL);
  const mostrarEdicion = editando;

  useEffect(() => {
    if (estadoNombre.exito) {
      setEditando(false);
    }
  }, [estadoNombre]);

  return (
    <li className="flex flex-col gap-3 py-3">
      {mostrarEdicion ? (
        <form action={accionNombre} className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <Campo
              id={`nombre-${elemento.id}`}
              name="nombre"
              etiqueta="Nombre"
              required
              maxLength={80}
              defaultValue={estadoNombre.valores.nombre ?? elemento.nombre}
              error={estadoNombre.errores.nombre}
            />
          </div>
          <div className="flex gap-2 sm:mt-7">
            <BotonEnvio textoPendiente="Guardando…">Guardar</BotonEnvio>
            <button
              type="button"
              onClick={() => {
                setEditando(false);
              }}
              className="min-h-11 rounded-md px-3 text-sm font-semibold text-apagado hover:bg-fondo"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-tinta">{elemento.nombre}</span>
            {elemento.activo ? null : <Insignia tono="peligro">Desactivado</Insignia>}
            <span className="text-xs text-apagado">
              {elemento.enUso === 0 ? 'Sin uso' : `En uso: ${String(elemento.enUso)}`}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEditando(true);
              }}
              className="min-h-11 rounded-md px-3 text-sm font-semibold text-marino-claro hover:bg-fondo"
            >
              Renombrar
            </button>
            <form action={accionCambio}>
              <button
                type="submit"
                className={
                  elemento.activo
                    ? 'min-h-11 rounded-md px-3 text-sm font-semibold text-rojo hover:bg-rojo-suave'
                    : 'min-h-11 rounded-md px-3 text-sm font-semibold text-verde hover:bg-verde-suave'
                }
              >
                {elemento.activo ? 'Desactivar' : 'Activar'}
              </button>
            </form>
          </div>
        </div>
      )}
      {estadoCambio.mensaje !== null && !estadoCambio.exito ? <MensajeFormulario estado={estadoCambio} /> : null}
      {estadoNombre.mensaje !== null && !estadoNombre.exito && !mostrarEdicion ? (
        <MensajeFormulario estado={estadoNombre} />
      ) : null}
    </li>
  );
}
