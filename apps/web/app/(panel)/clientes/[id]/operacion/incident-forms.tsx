'use client';

import { type EstadoIncidencia, ETIQUETAS_ESTADO_INCIDENCIA, type Incidencia } from '@sige/types';
import { AreaTexto, Campo, Insignia, Seleccion, type TonoInsignia } from '@sige/ui/components';
import { type ReactNode, useActionState, useState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';
import { formatearFecha, formatearFechaHora } from '@/lib/format';

type AccionFormulario = (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

const TONOS: Record<EstadoIncidencia, TonoInsignia> = {
  ABIERTA: 'peligro',
  EN_ATENCION: 'aviso',
  RESUELTA: 'exito',
  ANULADA: 'neutro',
};

const SIGUIENTES: Record<EstadoIncidencia, readonly EstadoIncidencia[]> = {
  ABIERTA: ['EN_ATENCION', 'RESUELTA', 'ANULADA'],
  EN_ATENCION: ['RESUELTA', 'ANULADA'],
  RESUELTA: [],
  ANULADA: [],
};

export function FormularioIncidencia({
  accion,
  equipo,
  fechaHoy,
}: {
  accion: AccionFormulario;
  equipo: { id: string; nombre: string }[];
  fechaHoy: string;
}): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const valor = (campo: string, predeterminado: string): string =>
    estado.exito ? predeterminado : (estado.valores[campo] ?? predeterminado);

  return (
    <form action={accionFormulario} key={estado.exito ? 'registrada' : 'incidencia'} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <Campo
        id="titulo-incidencia"
        name="titulo"
        etiqueta="Título"
        required
        maxLength={150}
        defaultValue={valor('titulo', '')}
        error={estado.errores.titulo}
      />
      <AreaTexto
        id="descripcion-incidencia"
        name="descripcion"
        etiqueta="Descripción"
        required
        rows={3}
        maxLength={3000}
        defaultValue={valor('descripcion', '')}
        error={estado.errores.descripcion}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id="fecha-incidencia"
          name="fecha"
          type="date"
          etiqueta="Fecha"
          required
          max={fechaHoy}
          defaultValue={valor('fecha', fechaHoy)}
          error={estado.errores.fecha}
        />
        <Seleccion
          id="responsable-incidencia"
          name="responsableId"
          etiqueta="Responsable"
          required
          defaultValue={valor('responsableId', '')}
          error={estado.errores.responsableId}
        >
          <option value="" disabled>
            Seleccione
          </option>
          {equipo.map((persona) => (
            <option key={persona.id} value={persona.id}>
              {persona.nombre}
            </option>
          ))}
        </Seleccion>
      </div>
      <BotonEnvio textoPendiente="Registrando…" className="self-start">
        Registrar incidencia
      </BotonEnvio>
    </form>
  );
}

export function FilaIncidencia({
  incidencia,
  cambiar,
}: {
  incidencia: Incidencia;
  cambiar: AccionFormulario | null;
}): ReactNode {
  const [estado, accion] = useActionState(cambiar ?? ((anterior: EstadoFormulario) => Promise.resolve(anterior)), ESTADO_INICIAL);
  const siguientes = SIGUIENTES[incidencia.estado];
  const [destino, setDestino] = useState<EstadoIncidencia | ''>('');

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-tinta">{incidencia.titulo}</p>
          <p className="whitespace-pre-line text-tinta">{incidencia.descripcion}</p>
          <p className="text-xs text-apagado">
            {formatearFecha(incidencia.fecha)} · Responsable: {incidencia.responsable.nombre} · Registró{' '}
            {incidencia.registradaPor}
          </p>
          {incidencia.resolucion === null ? null : (
            <p className="mt-1 text-xs text-tinta">
              <span className="font-semibold">Cierre:</span> {incidencia.resolucion}
              {incidencia.resueltaEn === null ? '' : ` · ${formatearFechaHora(incidencia.resueltaEn)}`}
            </p>
          )}
        </div>
        <Insignia tono={TONOS[incidencia.estado]}>{ETIQUETAS_ESTADO_INCIDENCIA[incidencia.estado]}</Insignia>
      </div>
      {cambiar !== null && siguientes.length > 0 ? (
        <form action={accion} className="flex flex-col gap-2 rounded-md border border-borde p-3">
          <MensajeFormulario estado={estado} />
          <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
            <Seleccion
              id={`estado-${incidencia.id}`}
              name="estado"
              etiqueta="Cambiar a"
              required
              value={destino}
              onChange={(evento) => {
                const elegido = siguientes.find((opcion) => opcion === evento.target.value);
                setDestino(elegido ?? '');
              }}
              error={estado.errores.estado}
            >
              <option value="" disabled>
                Seleccione
              </option>
              {siguientes.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {ETIQUETAS_ESTADO_INCIDENCIA[opcion]}
                </option>
              ))}
            </Seleccion>
            <Campo
              id={`comentario-${incidencia.id}`}
              name="comentario"
              etiqueta={destino === 'RESUELTA' ? 'Cómo se resolvió' : destino === 'ANULADA' ? 'Motivo' : 'Comentario (opcional)'}
              maxLength={2000}
              required={destino === 'RESUELTA' || destino === 'ANULADA'}
              error={estado.errores.comentario}
            />
          </div>
          <BotonEnvio variante="secundario" textoPendiente="Guardando…" className="self-start">
            Actualizar
          </BotonEnvio>
        </form>
      ) : null}
    </li>
  );
}
