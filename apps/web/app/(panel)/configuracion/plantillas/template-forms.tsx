'use client';

import { ETIQUETAS_PRIORIDAD, type Plantilla, PRIORIDADES } from '@sige/types';
import { AreaTexto, Campo, Casilla, Insignia, Seleccion } from '@sige/ui/components';
import { type ReactNode, useActionState, useState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

type AccionFormulario = (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

export function FormularioPlantilla({ accion, plantilla }: { accion: AccionFormulario; plantilla?: Plantilla }): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const sufijo = plantilla?.id ?? 'nueva';
  const reiniciar = estado.exito && plantilla === undefined;
  const [requiereEvidencia, setRequiereEvidencia] = useState(plantilla?.requiereEvidencia ?? false);
  const valor = (campo: string, predeterminado: string): string =>
    reiniciar ? predeterminado : (estado.valores[campo] ?? predeterminado);

  return (
    <form action={accionFormulario} key={reiniciar ? 'creada' : 'plantilla'} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id={`nombre-${sufijo}`}
          name="nombre"
          etiqueta="Nombre de la plantilla"
          required
          maxLength={120}
          defaultValue={valor('nombre', plantilla?.nombre ?? '')}
          error={estado.errores.nombre}
        />
        <Campo
          id={`titulo-${sufijo}`}
          name="titulo"
          etiqueta="Título de las tareas"
          required
          maxLength={200}
          defaultValue={valor('titulo', plantilla?.titulo ?? '')}
          error={estado.errores.titulo}
        />
      </div>
      <AreaTexto
        id={`instrucciones-${sufijo}`}
        name="instrucciones"
        etiqueta="Instrucciones (opcional)"
        rows={4}
        maxLength={5000}
        defaultValue={valor('instrucciones', plantilla?.instrucciones ?? '')}
        error={estado.errores.instrucciones}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Seleccion
          id={`prioridad-${sufijo}`}
          name="prioridad"
          etiqueta="Prioridad"
          defaultValue={valor('prioridad', plantilla?.prioridad ?? 'MEDIA')}
          error={estado.errores.prioridad}
        >
          {PRIORIDADES.map((prioridad) => (
            <option key={prioridad} value={prioridad}>
              {ETIQUETAS_PRIORIDAD[prioridad]}
            </option>
          ))}
        </Seleccion>
        <Campo
          id={`diasPlazo-${sufijo}`}
          name="diasPlazo"
          type="number"
          min={0}
          max={365}
          etiqueta="Plazo en días"
          ayuda="Días desde la creación hasta la fecha límite."
          required
          defaultValue={valor('diasPlazo', String(plantilla?.diasPlazo ?? 3))}
          error={estado.errores.diasPlazo}
        />
      </div>
      <Casilla
        id={`requiereAprobacion-${sufijo}`}
        name="requiereAprobacion"
        etiqueta="Requiere aprobación"
        descripcion="Las tareas pasan a revisión antes de cerrarse."
        defaultChecked={plantilla?.requiereAprobacion ?? false}
      />
      <Casilla
        id={`requiereEvidencia-${sufijo}`}
        name="requiereEvidencia"
        etiqueta="Requiere evidencia"
        checked={requiereEvidencia}
        onChange={(evento) => {
          setRequiereEvidencia(evento.target.checked);
        }}
      />
      {requiereEvidencia ? (
        <Campo
          id={`evidenciaRequerida-${sufijo}`}
          name="evidenciaRequerida"
          etiqueta="Evidencia esperada"
          required
          maxLength={300}
          defaultValue={valor('evidenciaRequerida', plantilla?.evidenciaRequerida ?? '')}
          error={estado.errores.evidenciaRequerida}
        />
      ) : null}
      <AreaTexto
        id={`items-${sufijo}`}
        name="items"
        etiqueta="Lista de verificación (opcional)"
        ayuda="Un paso por línea, hasta 30."
        rows={5}
        defaultValue={valor('items', plantilla?.items.join('\n') ?? '')}
        error={estado.errores.items}
      />
      <BotonEnvio textoPendiente="Guardando…" className="self-start">
        {plantilla === undefined ? 'Crear plantilla' : 'Guardar cambios'}
      </BotonEnvio>
    </form>
  );
}

export function FilaPlantilla({
  plantilla,
  editar,
  cambiarActivo,
}: {
  plantilla: Plantilla;
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
            {plantilla.nombre}
            {plantilla.activo ? null : <Insignia>Inactiva</Insignia>}
          </p>
          <p className="text-sm text-apagado">
            «{plantilla.titulo}» · {ETIQUETAS_PRIORIDAD[plantilla.prioridad]} · {plantilla.diasPlazo} días ·{' '}
            {plantilla.items.length} pasos · {plantilla.reglas} recurrentes activas
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
                plantilla.activo
                  ? 'min-h-11 rounded-md px-3 text-sm font-semibold text-rojo hover:bg-rojo-suave'
                  : 'min-h-11 rounded-md px-3 text-sm font-semibold text-verde hover:bg-verde/10'
              }
            >
              {plantilla.activo ? 'Desactivar' : 'Activar'}
            </button>
          </form>
        </div>
      </div>
      {estado.mensaje !== null && !estado.exito ? <MensajeFormulario estado={estado} /> : null}
      {abierto ? (
        <div className="rounded-md border border-borde p-4">
          <FormularioPlantilla accion={editar} plantilla={plantilla} />
        </div>
      ) : null}
    </li>
  );
}
