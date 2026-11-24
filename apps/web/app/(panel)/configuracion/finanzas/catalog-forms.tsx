'use client';

import { type ElementoFinanciero, ETIQUETAS_TIPO_SERVICIO, type Proveedor, TIPOS_SERVICIO } from '@sige/types';
import { Campo, Insignia, Seleccion } from '@sige/ui/components';
import { type ReactNode, useActionState, useState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

type AccionFormulario = (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

type AccionSinDatos = (anterior: EstadoFormulario) => Promise<EstadoFormulario>;

export function FormularioElemento({
  accion,
  conTipo,
  elemento,
}: {
  accion: AccionFormulario;
  conTipo: boolean;
  elemento?: ElementoFinanciero;
}): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const sufijo = elemento?.id ?? 'nuevo';
  const reiniciar = estado.exito && elemento === undefined;

  return (
    <form action={accionFormulario} key={reiniciar ? 'agregado' : 'elemento'} className="flex flex-col gap-3">
      <MensajeFormulario estado={estado} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <Campo
            id={`nombre-${sufijo}`}
            name="nombre"
            etiqueta="Nombre"
            required
            maxLength={conTipo ? 120 : 80}
            defaultValue={reiniciar ? '' : (estado.valores.nombre ?? elemento?.nombre ?? '')}
            error={estado.errores.nombre}
          />
        </div>
        {conTipo ? (
          <div className="w-44">
            <Seleccion
              id={`tipo-${sufijo}`}
              name="tipo"
              etiqueta="Tipo"
              defaultValue={estado.valores.tipo ?? elemento?.tipo ?? 'RECURRENTE'}
              error={estado.errores.tipo}
            >
              {TIPOS_SERVICIO.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {ETIQUETAS_TIPO_SERVICIO[tipo]}
                </option>
              ))}
            </Seleccion>
          </div>
        ) : null}
        <BotonEnvio variante="secundario" textoPendiente="Guardando…">
          {elemento === undefined ? 'Agregar' : 'Guardar'}
        </BotonEnvio>
      </div>
    </form>
  );
}

function BotonActivacion({ accion, activo }: { accion: AccionSinDatos; activo: boolean }): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={accionFormulario} className="flex items-center gap-2">
      {estado.exito || estado.mensaje === null ? null : <span className="text-xs text-rojo">{estado.mensaje}</span>}
      <BotonEnvio variante="sutil" textoPendiente="Guardando…">
        {activo ? 'Desactivar' : 'Activar'}
      </BotonEnvio>
    </form>
  );
}

export function FilaElemento({
  elemento,
  editar,
  activar,
  conTipo,
}: {
  elemento: ElementoFinanciero;
  editar: AccionFormulario;
  activar: AccionSinDatos;
  conTipo: boolean;
}): ReactNode {
  const [editando, setEditando] = useState(false);

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-tinta">
          {elemento.nombre}
          {elemento.tipo === null ? null : <Insignia tono="info">{ETIQUETAS_TIPO_SERVICIO[elemento.tipo]}</Insignia>}
          {elemento.activo ? null : <Insignia tono="neutro">Inactivo</Insignia>}
          <span className="text-xs font-normal text-apagado">{elemento.enUso} en uso</span>
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setEditando(!editando);
            }}
            aria-expanded={editando}
            className="min-h-11 rounded-md px-3 text-sm font-semibold text-marino hover:bg-marino/5"
          >
            {editando ? 'Cerrar' : 'Editar'}
          </button>
          <BotonActivacion accion={activar} activo={elemento.activo} />
        </div>
      </div>
      {editando ? <FormularioElemento accion={editar} conTipo={conTipo} elemento={elemento} /> : null}
    </li>
  );
}

export function FormularioProveedor({ accion, proveedor }: { accion: AccionFormulario; proveedor?: Proveedor }): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const sufijo = proveedor?.id ?? 'nuevo';
  const reiniciar = estado.exito && proveedor === undefined;
  const valor = (campo: string, predeterminado: string): string =>
    reiniciar ? predeterminado : (estado.valores[campo] ?? predeterminado);

  return (
    <form action={accionFormulario} key={reiniciar ? 'registrado' : 'proveedor'} className="flex flex-col gap-3">
      <MensajeFormulario estado={estado} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo
          id={`razonSocial-${sufijo}`}
          name="razonSocial"
          etiqueta="Razón social o nombre"
          required
          maxLength={200}
          defaultValue={valor('razonSocial', proveedor?.razonSocial ?? '')}
          error={estado.errores.razonSocial}
        />
        <Campo
          id={`ruc-${sufijo}`}
          name="ruc"
          etiqueta="RUC o DNI (opcional)"
          inputMode="numeric"
          maxLength={11}
          defaultValue={valor('ruc', proveedor?.ruc ?? '')}
          error={estado.errores.ruc}
        />
        <Campo
          id={`contacto-${sufijo}`}
          name="contacto"
          etiqueta="Contacto (opcional)"
          maxLength={150}
          defaultValue={valor('contacto', proveedor?.contacto ?? '')}
          error={estado.errores.contacto}
        />
      </div>
      <BotonEnvio variante="secundario" textoPendiente="Guardando…" className="self-start">
        {proveedor === undefined ? 'Registrar proveedor' : 'Guardar'}
      </BotonEnvio>
    </form>
  );
}

export function FilaProveedor({
  proveedor,
  editar,
  activar,
}: {
  proveedor: Proveedor;
  editar: AccionFormulario;
  activar: AccionSinDatos;
}): ReactNode {
  const [editando, setEditando] = useState(false);

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-tinta">
            {proveedor.razonSocial}
            {proveedor.activo ? null : <Insignia tono="neutro">Inactivo</Insignia>}
          </p>
          <p className="text-xs text-apagado">
            {proveedor.ruc ?? 'Sin documento'}
            {proveedor.contacto === null ? '' : ` · ${proveedor.contacto}`} · {proveedor.egresos} egresos
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setEditando(!editando);
            }}
            aria-expanded={editando}
            className="min-h-11 rounded-md px-3 text-sm font-semibold text-marino hover:bg-marino/5"
          >
            {editando ? 'Cerrar' : 'Editar'}
          </button>
          <BotonActivacion accion={activar} activo={proveedor.activo} />
        </div>
      </div>
      {editando ? <FormularioProveedor accion={editar} proveedor={proveedor} /> : null}
    </li>
  );
}
