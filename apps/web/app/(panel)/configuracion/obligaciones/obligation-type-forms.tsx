'use client';

import { DIAS_ALERTA_PREDETERMINADOS, type TipoObligacion } from '@sige/types';
import { AreaTexto, Campo, Casilla, Insignia } from '@sige/ui/components';
import { type ReactNode, useActionState, useState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

type AccionFormulario = (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

export function FormularioTipoObligacion({
  accion,
  tipo,
}: {
  accion: AccionFormulario;
  tipo?: TipoObligacion;
}): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const sufijo = tipo?.id ?? 'nuevo';
  const reiniciar = estado.exito && tipo === undefined;
  const [usaCronograma, setUsaCronograma] = useState(tipo?.usaCronograma ?? true);
  const valor = (campo: string, predeterminado: string): string =>
    reiniciar ? predeterminado : (estado.valores[campo] ?? predeterminado);

  return (
    <form action={accionFormulario} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <Campo
          id={`codigo-${sufijo}`}
          name="codigo"
          etiqueta="Código"
          required
          maxLength={20}
          defaultValue={valor('codigo', tipo?.codigo ?? '')}
          error={estado.errores.codigo}
        />
        <Campo
          id={`nombre-${sufijo}`}
          name="nombre"
          etiqueta="Nombre"
          required
          maxLength={120}
          defaultValue={valor('nombre', tipo?.nombre ?? '')}
          error={estado.errores.nombre}
        />
      </div>
      <AreaTexto
        id={`descripcion-${sufijo}`}
        name="descripcion"
        etiqueta="Descripción (opcional)"
        maxLength={500}
        defaultValue={valor('descripcion', tipo?.descripcion ?? '')}
        error={estado.errores.descripcion}
      />
      <Casilla
        id={`usaCronograma-${sufijo}`}
        name="usaCronograma"
        etiqueta="Vence según el cronograma oficial de SUNAT"
        descripcion="La fecha sale del cronograma cargado para el periodo y el último dígito del RUC."
        checked={usaCronograma}
        onChange={(evento) => {
          setUsaCronograma(evento.target.checked);
        }}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {usaCronograma ? null : (
          <Campo
            id={`diaVencimiento-${sufijo}`}
            name="diaVencimiento"
            type="number"
            min={1}
            max={28}
            etiqueta="Día de vencimiento"
            ayuda="Día del mes siguiente al periodo (plazo interno)."
            required
            defaultValue={valor('diaVencimiento', tipo?.diaVencimiento === null || tipo === undefined ? '' : String(tipo.diaVencimiento))}
            error={estado.errores.diaVencimiento}
          />
        )}
        <Campo
          id={`diasAlerta-${sufijo}`}
          name="diasAlerta"
          etiqueta="Avisar con anticipación (días)"
          ayuda="Separe los días con comas. Se avisa al responsable y al revisor."
          defaultValue={valor('diasAlerta', (tipo?.diasAlerta ?? DIAS_ALERTA_PREDETERMINADOS).join(', '))}
          error={estado.errores.diasAlerta}
        />
      </div>
      <BotonEnvio textoPendiente="Guardando…" className="self-start">
        {tipo === undefined ? 'Crear tipo' : 'Guardar cambios'}
      </BotonEnvio>
    </form>
  );
}

export function FilaTipoObligacion({
  tipo,
  editar,
  cambiarActivo,
}: {
  tipo: TipoObligacion;
  editar: AccionFormulario;
  cambiarActivo: (anterior: EstadoFormulario) => Promise<EstadoFormulario>;
}): ReactNode {
  const [abierto, setAbierto] = useState(false);
  const [estado, accionActivo] = useActionState(cambiarActivo, ESTADO_INICIAL);

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-tinta">
            {tipo.nombre}
            <span className="text-xs font-medium text-apagado">{tipo.codigo}</span>
            {tipo.activo ? null : <Insignia>Inactivo</Insignia>}
          </p>
          <p className="text-sm text-apagado">
            {tipo.usaCronograma ? 'Cronograma oficial' : `Plazo interno: día ${String(tipo.diaVencimiento)} del mes siguiente`}{' '}
            · Avisos {tipo.diasAlerta.length === 0 ? 'desactivados' : `${tipo.diasAlerta.join(', ')} días antes`} ·{' '}
            {tipo.clientesConfigurados} {tipo.clientesConfigurados === 1 ? 'cliente' : 'clientes'}
          </p>
          {tipo.descripcion === null ? null : <p className="mt-1 text-sm text-tinta">{tipo.descripcion}</p>}
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
          <FormularioTipoObligacion accion={editar} tipo={tipo} />
        </div>
      ) : null}
    </li>
  );
}
