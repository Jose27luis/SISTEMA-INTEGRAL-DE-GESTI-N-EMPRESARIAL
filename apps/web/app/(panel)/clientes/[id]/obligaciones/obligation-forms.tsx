'use client';

import { ETIQUETAS_GRUPO_CRONOGRAMA, GRUPOS_CRONOGRAMA, type GrupoCronograma, type ObligacionCliente } from '@sige/types';
import { Campo, Seleccion } from '@sige/ui/components';
import { type ReactNode, useActionState, useState } from 'react';
import { FormularioConfirmacion } from '@/components/confirm-action-form';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

type AccionFormulario = (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

interface Opcion {
  id: string;
  nombre: string;
}

interface TipoOpcion extends Opcion {
  usaCronograma: boolean;
}

export function FormularioGrupo({ accion, grupo }: { accion: AccionFormulario; grupo: GrupoCronograma }): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={accionFormulario} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <Seleccion
        id="grupoCronograma"
        name="grupoCronograma"
        etiqueta="Grupo del cronograma"
        ayuda="Los buenos contribuyentes y las UESP tienen su propia columna en el cronograma de SUNAT."
        defaultValue={estado.valores.grupoCronograma ?? grupo}
        error={estado.errores.grupoCronograma}
      >
        {GRUPOS_CRONOGRAMA.map((opcion) => (
          <option key={opcion} value={opcion}>
            {ETIQUETAS_GRUPO_CRONOGRAMA[opcion]}
          </option>
        ))}
      </Seleccion>
      <BotonEnvio variante="secundario" textoPendiente="Guardando…" className="self-start">
        Guardar grupo
      </BotonEnvio>
    </form>
  );
}

interface PropiedadesFormularioObligacion {
  accion: AccionFormulario;
  tipos: TipoOpcion[];
  equipo: Opcion[];
  periodoInicial: string;
  obligacion?: ObligacionCliente;
}

export function FormularioObligacion({
  accion,
  tipos,
  equipo,
  periodoInicial,
  obligacion,
}: PropiedadesFormularioObligacion): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const edicion = obligacion !== undefined;
  const valor = (campo: string, predeterminado: string): string =>
    estado.exito && !edicion ? predeterminado : (estado.valores[campo] ?? predeterminado);

  return (
    <form action={accionFormulario} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      {edicion ? (
        <input type="hidden" name="tipoObligacionId" value={obligacion.tipoObligacion.id} />
      ) : (
        <Seleccion
          id="tipoObligacionId"
          name="tipoObligacionId"
          etiqueta="Obligación"
          required
          defaultValue={valor('tipoObligacionId', '')}
          error={estado.errores.tipoObligacionId}
        >
          <option value="" disabled>
            Seleccione
          </option>
          {tipos.map((tipo) => (
            <option key={tipo.id} value={tipo.id}>
              {tipo.nombre}
              {tipo.usaCronograma ? '' : ' (plazo interno)'}
            </option>
          ))}
        </Seleccion>
      )}
      {edicion && estado.errores.tipoObligacionId !== undefined ? (
        <p className="text-sm font-medium text-rojo">{estado.errores.tipoObligacionId}</p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Seleccion
          id={`responsableId-${obligacion?.id ?? 'nueva'}`}
          name="responsableId"
          etiqueta="Responsable"
          required
          defaultValue={valor('responsableId', obligacion?.responsable.id ?? '')}
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
        <Seleccion
          id={`revisorId-${obligacion?.id ?? 'nueva'}`}
          name="revisorId"
          etiqueta="Revisor"
          ayuda="Sin revisor, la obligación queda cumplida al registrar la presentación."
          defaultValue={valor('revisorId', obligacion?.revisor?.id ?? '')}
          error={estado.errores.revisorId}
        >
          <option value="">Sin revisor</option>
          {equipo.map((persona) => (
            <option key={persona.id} value={persona.id}>
              {persona.nombre}
            </option>
          ))}
        </Seleccion>
        <Campo
          id={`desdePeriodo-${obligacion?.id ?? 'nueva'}`}
          name="desdePeriodo"
          type="month"
          etiqueta="Desde el periodo"
          required
          defaultValue={valor('desdePeriodo', obligacion?.desdePeriodo ?? periodoInicial)}
          error={estado.errores.desdePeriodo}
        />
        <Campo
          id={`hastaPeriodo-${obligacion?.id ?? 'nueva'}`}
          name="hastaPeriodo"
          type="month"
          etiqueta="Hasta el periodo (opcional)"
          defaultValue={valor('hastaPeriodo', obligacion?.hastaPeriodo ?? '')}
          error={estado.errores.hastaPeriodo}
        />
      </div>
      <BotonEnvio textoPendiente="Guardando…" className="self-start">
        {edicion ? 'Guardar cambios' : 'Configurar obligación'}
      </BotonEnvio>
    </form>
  );
}

interface PropiedadesFilaObligacion {
  obligacion: ObligacionCliente;
  puedeGestionar: boolean;
  editar: AccionFormulario;
  desactivar: AccionFormulario;
  tipos: TipoOpcion[];
  equipo: Opcion[];
}

export function FilaObligacion({
  obligacion,
  puedeGestionar,
  editar,
  desactivar,
  tipos,
  equipo,
}: PropiedadesFilaObligacion): ReactNode {
  const [modo, setModo] = useState<'ver' | 'editar' | 'desactivar'>('ver');
  const vigencia =
    obligacion.hastaPeriodo === null
      ? `Desde ${obligacion.desdePeriodo}`
      : `De ${obligacion.desdePeriodo} a ${obligacion.hastaPeriodo}`;

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-tinta">
            {obligacion.tipoObligacion.nombre}
            {obligacion.activo ? null : <span className="ml-2 text-xs font-semibold text-apagado uppercase">Desactivada</span>}
          </p>
          <p className="text-sm text-apagado">
            {vigencia} · Responsable: {obligacion.responsable.nombre} · Revisor: {obligacion.revisor?.nombre ?? 'sin revisor'}
          </p>
        </div>
        {puedeGestionar && obligacion.activo ? (
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
                setModo(modo === 'desactivar' ? 'ver' : 'desactivar');
              }}
              aria-expanded={modo === 'desactivar'}
              className="min-h-11 rounded-md px-3 text-sm font-semibold text-rojo hover:bg-rojo-suave"
            >
              {modo === 'desactivar' ? 'Cerrar' : 'Desactivar'}
            </button>
          </div>
        ) : null}
      </div>
      {modo === 'editar' ? (
        <div className="rounded-md border border-borde p-4">
          <FormularioObligacion
            accion={editar}
            tipos={tipos}
            equipo={equipo}
            periodoInicial={obligacion.desdePeriodo}
            obligacion={obligacion}
          />
        </div>
      ) : null}
      {modo === 'desactivar' ? (
        <div className="rounded-md border border-rojo/30 p-4">
          <FormularioConfirmacion
            accion={desactivar}
            etiquetaBoton="Desactivar obligación"
            textoPendiente="Desactivando…"
            variante="peligro"
            pedirMotivo
            consecuencia="Deja de generarse desde el próximo periodo. Las obligaciones ya generadas y su historial se conservan."
          />
        </div>
      ) : null}
    </li>
  );
}
