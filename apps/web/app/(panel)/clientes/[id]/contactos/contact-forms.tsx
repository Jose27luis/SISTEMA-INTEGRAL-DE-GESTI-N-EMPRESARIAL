'use client';

import type { Contacto } from '@sige/types';
import { Campo, Casilla, Insignia } from '@sige/ui/components';
import { Mail, Phone } from 'lucide-react';
import { type ReactNode, useActionState, useEffect, useState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

type AccionFormulario = (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

function CamposContacto({
  prefijo,
  contacto,
  estado,
}: {
  prefijo: string;
  contacto: Contacto | null;
  estado: EstadoFormulario;
}): ReactNode {
  const valor = (campo: string, actual: string | null | undefined): string | undefined =>
    estado.valores[campo] ?? actual ?? undefined;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo
        id={`${prefijo}-nombre`}
        name="nombre"
        etiqueta="Nombre"
        required
        maxLength={120}
        defaultValue={estado.exito && contacto === null ? '' : valor('nombre', contacto?.nombre)}
        error={estado.errores.nombre}
      />
      <Campo
        id={`${prefijo}-cargo`}
        name="cargo"
        etiqueta="Cargo"
        maxLength={80}
        defaultValue={estado.exito && contacto === null ? '' : valor('cargo', contacto?.cargo)}
        error={estado.errores.cargo}
      />
      <Campo
        id={`${prefijo}-correo`}
        name="correo"
        type="email"
        etiqueta="Correo"
        maxLength={150}
        defaultValue={estado.exito && contacto === null ? '' : valor('correo', contacto?.correo)}
        error={estado.errores.correo}
      />
      <Campo
        id={`${prefijo}-telefono`}
        name="telefono"
        type="tel"
        etiqueta="Teléfono"
        maxLength={30}
        defaultValue={estado.exito && contacto === null ? '' : valor('telefono', contacto?.telefono)}
        error={estado.errores.telefono}
      />
      <Casilla
        id={`${prefijo}-principal`}
        name="principal"
        etiqueta="Contacto principal"
        descripcion="Reemplaza al contacto principal actual."
        defaultChecked={contacto?.principal ?? false}
        className="sm:col-span-2"
      />
    </div>
  );
}

export function FormularioNuevoContacto({ accion }: { accion: AccionFormulario }): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={accionFormulario} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <CamposContacto key={estado.exito ? 'limpio' : 'edicion'} prefijo="nuevo" contacto={null} estado={estado} />
      <BotonEnvio textoPendiente="Agregando…" className="self-start">
        Agregar contacto
      </BotonEnvio>
    </form>
  );
}

interface PropiedadesTarjetaContacto {
  contacto: Contacto;
  puedeGestionar: boolean;
  editar: AccionFormulario;
  desactivar: (anterior: EstadoFormulario) => Promise<EstadoFormulario>;
}

export function TarjetaContacto({ contacto, puedeGestionar, editar, desactivar }: PropiedadesTarjetaContacto): ReactNode {
  const [editando, setEditando] = useState(false);
  const [estadoEdicion, accionEdicion] = useActionState(editar, ESTADO_INICIAL);
  const [estadoBaja, accionBaja] = useActionState(desactivar, ESTADO_INICIAL);

  useEffect(() => {
    if (estadoEdicion.exito) {
      setEditando(false);
    }
  }, [estadoEdicion]);

  return (
    <li className="flex flex-col gap-3 py-4">
      {editando ? (
        <form action={accionEdicion} className="flex flex-col gap-4">
          <MensajeFormulario estado={estadoEdicion} />
          <CamposContacto prefijo={contacto.id} contacto={contacto} estado={estadoEdicion} />
          <div className="flex gap-2">
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="flex flex-wrap items-center gap-2 font-semibold text-tinta">
              {contacto.nombre}
              {contacto.principal ? <Insignia tono="info">Principal</Insignia> : null}
            </p>
            {contacto.cargo === null ? null : <p className="text-sm text-apagado">{contacto.cargo}</p>}
            <div className="flex flex-wrap gap-4 text-sm">
              {contacto.correo === null ? null : (
                <a href={`mailto:${contacto.correo}`} className="inline-flex items-center gap-1.5 text-marino-claro hover:underline">
                  <Mail aria-hidden="true" className="size-4" />
                  {contacto.correo}
                </a>
              )}
              {contacto.telefono === null ? null : (
                <a href={`tel:${contacto.telefono}`} className="inline-flex items-center gap-1.5 text-marino-claro hover:underline">
                  <Phone aria-hidden="true" className="size-4" />
                  {contacto.telefono}
                </a>
              )}
            </div>
          </div>
          {puedeGestionar ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditando(true);
                }}
                className="min-h-11 rounded-md px-3 text-sm font-semibold text-marino-claro hover:bg-fondo"
              >
                Editar
              </button>
              <form action={accionBaja}>
                <button type="submit" className="min-h-11 rounded-md px-3 text-sm font-semibold text-rojo hover:bg-rojo-suave">
                  Desactivar
                </button>
              </form>
            </div>
          ) : null}
        </div>
      )}
      {estadoBaja.mensaje !== null && !estadoBaja.exito ? <MensajeFormulario estado={estadoBaja} /> : null}
    </li>
  );
}
