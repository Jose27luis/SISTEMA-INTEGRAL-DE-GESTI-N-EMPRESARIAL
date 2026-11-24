'use client';

import {
  type FichaComercial,
  ETIQUETAS_PERIODICIDAD,
  PERIODICIDADES,
  type ServicioContratado,
} from '@sige/types';
import { AreaTexto, Campo, Insignia, Seleccion } from '@sige/ui/components';
import { type ReactNode, useActionState, useState } from 'react';
import { FormularioConfirmacion } from '@/components/confirm-action-form';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';
import { formatearFecha, formatearMoneda } from '@/lib/format';

type AccionFormulario = (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

interface Opcion {
  id: string;
  nombre: string;
}

export function FormularioContrato({
  accion,
  contrato,
  documentos,
}: {
  accion: AccionFormulario;
  contrato: FichaComercial['contrato'];
  documentos: { id: string; titulo: string }[];
}): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const valor = (campo: string, predeterminado: string): string => estado.valores[campo] ?? predeterminado;

  return (
    <form action={accionFormulario} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo
          id="inicio"
          name="inicio"
          type="date"
          etiqueta="Inicio"
          required
          defaultValue={valor('inicio', contrato?.inicio ?? '')}
          error={estado.errores.inicio}
        />
        <Campo
          id="vencimiento"
          name="vencimiento"
          type="date"
          etiqueta="Vencimiento (opcional)"
          defaultValue={valor('vencimiento', contrato?.vencimiento ?? '')}
          error={estado.errores.vencimiento}
        />
        <Campo
          id="diaPago"
          name="diaPago"
          type="number"
          min={1}
          max={28}
          etiqueta="Día de pago"
          ayuda="Vencimiento de los honorarios de cada mes."
          required
          defaultValue={valor('diaPago', String(contrato?.diaPago ?? 10))}
          error={estado.errores.diaPago}
        />
      </div>
      <Seleccion
        id="documentoId"
        name="documentoId"
        etiqueta="Contrato firmado (opcional)"
        ayuda="Súbalo antes en la pestaña Documentos."
        defaultValue={valor('documentoId', contrato?.documento?.id ?? '')}
        error={estado.errores.documentoId}
      >
        <option value="">Sin documento vinculado</option>
        {documentos.map((documento) => (
          <option key={documento.id} value={documento.id}>
            {documento.titulo}
          </option>
        ))}
      </Seleccion>
      <AreaTexto
        id="condicionesPago"
        name="condicionesPago"
        etiqueta="Condiciones de pago (opcional)"
        maxLength={1000}
        defaultValue={valor('condicionesPago', contrato?.condicionesPago ?? '')}
        error={estado.errores.condicionesPago}
      />
      <AreaTexto
        id="observaciones-contrato"
        name="observaciones"
        etiqueta="Observaciones (opcional)"
        maxLength={2000}
        defaultValue={valor('observaciones', contrato?.observaciones ?? '')}
        error={estado.errores.observaciones}
      />
      <BotonEnvio textoPendiente="Guardando…" className="self-start">
        Guardar contrato
      </BotonEnvio>
    </form>
  );
}

export function FormularioServicio({
  accion,
  servicios,
  contratado,
  hoy,
}: {
  accion: AccionFormulario;
  servicios: Opcion[];
  contratado?: ServicioContratado;
  hoy: string;
}): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const sufijo = contratado?.id ?? 'nuevo';
  const reiniciar = estado.exito && contratado === undefined;
  const valor = (campo: string, predeterminado: string): string =>
    reiniciar ? predeterminado : (estado.valores[campo] ?? predeterminado);

  return (
    <form action={accionFormulario} key={reiniciar ? 'registrado' : 'servicio'} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Seleccion
          id={`servicioId-${sufijo}`}
          name="servicioId"
          etiqueta="Servicio"
          required
          defaultValue={valor('servicioId', contratado?.servicio.id ?? '')}
          error={estado.errores.servicioId}
        >
          <option value="" disabled>
            Seleccione
          </option>
          {servicios.map((servicio) => (
            <option key={servicio.id} value={servicio.id}>
              {servicio.nombre}
            </option>
          ))}
        </Seleccion>
        <Campo
          id={`honorario-${sufijo}`}
          name="honorario"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          etiqueta="Honorario (S/)"
          required
          defaultValue={valor('honorario', contratado === undefined ? '' : contratado.honorario.toFixed(2))}
          error={estado.errores.honorario}
        />
        <Seleccion
          id={`periodicidad-${sufijo}`}
          name="periodicidad"
          etiqueta="Periodicidad"
          defaultValue={valor('periodicidad', contratado?.periodicidad ?? 'MENSUAL')}
          error={estado.errores.periodicidad}
        >
          {PERIODICIDADES.map((periodicidad) => (
            <option key={periodicidad} value={periodicidad}>
              {ETIQUETAS_PERIODICIDAD[periodicidad]}
            </option>
          ))}
        </Seleccion>
        <Campo
          id={`desde-${sufijo}`}
          name="desde"
          type="date"
          etiqueta="Desde"
          required
          defaultValue={valor('desde', contratado?.desde ?? hoy)}
          error={estado.errores.desde}
        />
        <Campo
          id={`hasta-${sufijo}`}
          name="hasta"
          type="date"
          etiqueta="Hasta (opcional)"
          defaultValue={valor('hasta', contratado?.hasta ?? '')}
          error={estado.errores.hasta}
        />
      </div>
      <AreaTexto
        id={`observaciones-${sufijo}`}
        name="observaciones"
        etiqueta="Observaciones (opcional)"
        maxLength={500}
        defaultValue={valor('observaciones', contratado?.observaciones ?? '')}
        error={estado.errores.observaciones}
      />
      <BotonEnvio textoPendiente="Guardando…" className="self-start">
        {contratado === undefined ? 'Agregar servicio' : 'Guardar cambios'}
      </BotonEnvio>
    </form>
  );
}

export function FilaServicio({
  contratado,
  editar,
  darDeBaja,
  servicios,
  puedeGestionar,
  hoy,
}: {
  contratado: ServicioContratado;
  editar: AccionFormulario;
  darDeBaja: AccionFormulario;
  servicios: Opcion[];
  puedeGestionar: boolean;
  hoy: string;
}): ReactNode {
  const [modo, setModo] = useState<'ver' | 'editar' | 'baja'>('ver');

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 text-sm">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-tinta">
            {contratado.servicio.nombre}
            {contratado.activo ? null : <Insignia tono="neutro">Dado de baja</Insignia>}
          </p>
          <p className="text-tinta">
            {formatearMoneda(contratado.honorario)} · {ETIQUETAS_PERIODICIDAD[contratado.periodicidad]}
          </p>
          <p className="text-xs text-apagado">
            Desde {formatearFecha(contratado.desde)}
            {contratado.hasta === null ? '' : ` hasta ${formatearFecha(contratado.hasta)}`}
          </p>
          {contratado.observaciones === null ? null : (
            <p className="mt-1 text-xs whitespace-pre-line text-tinta">{contratado.observaciones}</p>
          )}
        </div>
        {puedeGestionar && contratado.activo ? (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => {
                setModo(modo === 'editar' ? 'ver' : 'editar');
              }}
              aria-expanded={modo === 'editar'}
              className="min-h-11 rounded-md px-3 text-sm font-semibold text-marino hover:bg-marino/5"
            >
              {modo === 'editar' ? 'Cerrar' : 'Editar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setModo(modo === 'baja' ? 'ver' : 'baja');
              }}
              aria-expanded={modo === 'baja'}
              className="min-h-11 rounded-md px-3 text-sm font-semibold text-rojo hover:bg-rojo/5"
            >
              {modo === 'baja' ? 'Cerrar' : 'Dar de baja'}
            </button>
          </div>
        ) : null}
      </div>
      {modo === 'editar' ? (
        <div className="rounded-md border border-borde p-4">
          <FormularioServicio accion={editar} servicios={servicios} contratado={contratado} hoy={hoy} />
        </div>
      ) : null}
      {modo === 'baja' ? (
        <div className="rounded-md border border-borde p-4">
          <FormularioConfirmacion
            accion={darDeBaja}
            etiquetaBoton="Dar de baja"
            textoPendiente="Guardando…"
            variante="peligro"
            pedirMotivo
          />
        </div>
      ) : null}
    </li>
  );
}
