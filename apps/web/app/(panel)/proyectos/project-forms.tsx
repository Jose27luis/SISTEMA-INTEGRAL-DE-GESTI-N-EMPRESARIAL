'use client';

import {
  type EstadoProyecto,
  ESTADOS_ETAPA,
  type Etapa,
  ETIQUETAS_ESTADO_ETAPA,
  ETIQUETAS_ESTADO_PROYECTO,
  type OpcionesProyecto,
  type ProyectoDetalle,
  TAMANO_MAXIMO_ENTREGABLE_MB,
} from '@sige/types';
import { AreaTexto, Campo, Casilla, Seleccion } from '@sige/ui/components';
import { type ReactNode, useActionState, useId, useState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

type AccionFormulario = (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

type AccionSinDatos = (anterior: EstadoFormulario) => Promise<EstadoFormulario>;

export function FormularioProyecto({
  accion,
  opciones,
  proyecto,
  hoy,
  usuarioId,
}: {
  accion: AccionFormulario;
  opciones: OpcionesProyecto;
  proyecto: ProyectoDetalle | null;
  hoy: string;
  usuarioId: string;
}): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const [responsableId, setResponsableId] = useState(proyecto?.responsable.id ?? usuarioId);
  const [miembros, setMiembros] = useState<string[]>(proyecto?.miembros.map(({ id }) => id) ?? []);
  const valor = (campo: string, actual: string): string => estado.valores[campo] ?? actual;
  const sufijo = proyecto?.id ?? 'nuevo';

  return (
    <form action={accionFormulario} className="flex flex-col gap-5">
      <MensajeFormulario estado={estado} />
      <Campo
        id={`nombre-${sufijo}`}
        name="nombre"
        etiqueta="Nombre del proyecto"
        required
        maxLength={200}
        defaultValue={valor('nombre', proyecto?.nombre ?? '')}
        error={estado.errores.nombre}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Seleccion
          id={`clienteId-${sufijo}`}
          name="clienteId"
          etiqueta="Cliente"
          defaultValue={valor('clienteId', proyecto?.cliente?.id ?? '')}
          error={estado.errores.clienteId}
        >
          <option value="">Proyecto interno</option>
          {opciones.clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.nombre}
            </option>
          ))}
        </Seleccion>
        <Seleccion
          id={`servicioId-${sufijo}`}
          name="servicioId"
          etiqueta="Tipo de servicio (opcional)"
          defaultValue={valor('servicioId', proyecto?.servicio?.id ?? '')}
          error={estado.errores.servicioId}
        >
          <option value="">Sin servicio</option>
          {opciones.servicios.map((servicio) => (
            <option key={servicio.id} value={servicio.id}>
              {servicio.nombre}
            </option>
          ))}
        </Seleccion>
        <Campo
          id={`fechaInicio-${sufijo}`}
          name="fechaInicio"
          type="date"
          etiqueta="Inicio"
          required
          defaultValue={valor('fechaInicio', proyecto?.fechaInicio ?? hoy)}
          error={estado.errores.fechaInicio}
        />
        <Campo
          id={`fechaEntrega-${sufijo}`}
          name="fechaEntrega"
          type="date"
          etiqueta="Entrega"
          required
          defaultValue={valor('fechaEntrega', proyecto?.fechaEntrega ?? '')}
          error={estado.errores.fechaEntrega}
        />
        <Campo
          id={`presupuesto-${sufijo}`}
          name="presupuesto"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          etiqueta="Presupuesto en S/ (opcional)"
          defaultValue={valor('presupuesto', proyecto?.presupuesto?.toFixed(2) ?? '')}
          error={estado.errores.presupuesto}
        />
        <Campo
          id={`honorarios-${sufijo}`}
          name="honorarios"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          etiqueta="Honorarios en S/ (opcional)"
          defaultValue={valor('honorarios', proyecto?.honorarios?.toFixed(2) ?? '')}
          error={estado.errores.honorarios}
        />
      </div>
      <AreaTexto
        id={`objetivo-${sufijo}`}
        name="objetivo"
        etiqueta="Objetivo (opcional)"
        maxLength={2000}
        defaultValue={valor('objetivo', proyecto?.objetivo ?? '')}
        error={estado.errores.objetivo}
      />
      <AreaTexto
        id={`descripcion-${sufijo}`}
        name="descripcion"
        etiqueta="Descripción (opcional)"
        maxLength={5000}
        defaultValue={valor('descripcion', proyecto?.descripcion ?? '')}
        error={estado.errores.descripcion}
      />
      <fieldset className="grid gap-3">
        <legend className="mb-1 text-base font-semibold text-marino">Equipo</legend>
        <Seleccion
          id={`responsableId-${sufijo}`}
          name="responsableId"
          etiqueta="Responsable"
          required
          value={responsableId}
          onChange={(evento) => {
            setResponsableId(evento.target.value);
          }}
          error={estado.errores.responsableId}
        >
          {opciones.usuarios.map((usuario) => (
            <option key={usuario.id} value={usuario.id}>
              {usuario.nombre}
            </option>
          ))}
        </Seleccion>
        <p className="text-sm text-apagado">
          Integrantes: pueden ver el proyecto, recibir tareas y entregar. Si el proyecto es de un cliente, deben estar asignados a él.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {opciones.usuarios
            .filter(({ id }) => id !== responsableId)
            .map((usuario) => (
              <Casilla
                key={usuario.id}
                id={`miembro-${sufijo}-${usuario.id}`}
                name="miembroIds"
                value={usuario.id}
                etiqueta={usuario.nombre}
                checked={miembros.includes(usuario.id)}
                onChange={(evento) => {
                  const marcado = evento.target.checked;
                  setMiembros((actuales) => (marcado ? [...actuales, usuario.id] : actuales.filter((id) => id !== usuario.id)));
                }}
              />
            ))}
        </div>
        {estado.errores.miembroIds === undefined ? null : (
          <p className="text-sm font-medium text-rojo">{estado.errores.miembroIds}</p>
        )}
      </fieldset>
      <BotonEnvio textoPendiente="Guardando…" className="self-start">
        {proyecto === null ? 'Crear proyecto' : 'Guardar cambios'}
      </BotonEnvio>
    </form>
  );
}

export function FormularioEstadoProyecto({
  accion,
  transiciones,
}: {
  accion: AccionFormulario;
  transiciones: readonly EstadoProyecto[];
}): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const [destino, setDestino] = useState<string>(transiciones[0] ?? '');
  const id = useId();
  const cierra = destino === 'FINALIZADO' || destino === 'CANCELADO';

  return (
    <form action={accionFormulario} className="flex flex-col gap-3">
      <MensajeFormulario estado={estado} />
      <Seleccion
        id={`${id}-estado`}
        name="estado"
        etiqueta="Nuevo estado"
        value={destino}
        onChange={(evento) => {
          setDestino(evento.target.value);
        }}
        error={estado.errores.estado}
      >
        {transiciones.map((opcion) => (
          <option key={opcion} value={opcion}>
            {ETIQUETAS_ESTADO_PROYECTO[opcion]}
          </option>
        ))}
      </Seleccion>
      <AreaTexto
        id={`${id}-comentario`}
        name="comentario"
        etiqueta={destino === 'FINALIZADO' ? 'Resultado final' : destino === 'CANCELADO' ? 'Motivo de la cancelación' : 'Comentario (opcional)'}
        required={cierra}
        maxLength={2000}
        defaultValue={estado.exito ? '' : estado.valores.comentario}
        error={estado.errores.comentario}
      />
      <BotonEnvio variante={cierra ? 'peligro' : 'secundario'} textoPendiente="Guardando…" className="self-start">
        Cambiar estado
      </BotonEnvio>
    </form>
  );
}

export function FormularioDificultad({
  accion,
  conDificultades,
  detalle,
}: {
  accion: AccionFormulario;
  conDificultades: boolean;
  detalle: string | null;
}): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const id = useId();

  return (
    <form action={accionFormulario} className="flex flex-col gap-3">
      <MensajeFormulario estado={estado} />
      {conDificultades ? (
        <input type="hidden" name="conDificultades" value="" />
      ) : (
        <>
          <input type="hidden" name="conDificultades" value="on" />
          <AreaTexto
            id={`${id}-detalle`}
            name="detalle"
            etiqueta="Qué está pasando"
            ayuda="Gerencia lo verá en el tablero."
            required
            minLength={5}
            maxLength={1000}
            defaultValue={estado.valores.detalle}
            error={estado.errores.detalle}
          />
        </>
      )}
      {conDificultades && detalle !== null ? <p className="text-sm whitespace-pre-line text-tinta">{detalle}</p> : null}
      <BotonEnvio variante={conDificultades ? 'secundario' : 'peligro'} textoPendiente="Guardando…" className="self-start">
        {conDificultades ? 'Marcar como resuelta' : 'Reportar dificultad'}
      </BotonEnvio>
    </form>
  );
}

export function FormularioEtapa({ accion, etapa, hoy }: { accion: AccionFormulario; etapa?: Etapa; hoy: string }): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const sufijo = etapa?.id ?? 'nueva';
  const reiniciar = estado.exito && etapa === undefined;
  const valor = (campo: string, actual: string): string => (reiniciar ? actual : (estado.valores[campo] ?? actual));

  return (
    <form action={accionFormulario} key={reiniciar ? 'agregada' : 'etapa'} className="flex flex-col gap-3">
      <MensajeFormulario estado={estado} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          id={`etapa-nombre-${sufijo}`}
          name="nombre"
          etiqueta="Etapa"
          required
          maxLength={120}
          defaultValue={valor('nombre', etapa?.nombre ?? '')}
          error={estado.errores.nombre}
        />
        <Seleccion
          id={`etapa-estado-${sufijo}`}
          name="estado"
          etiqueta="Estado"
          defaultValue={valor('estado', etapa?.estado ?? 'PENDIENTE')}
          error={estado.errores.estado}
        >
          {ESTADOS_ETAPA.map((opcion) => (
            <option key={opcion} value={opcion}>
              {ETIQUETAS_ESTADO_ETAPA[opcion]}
            </option>
          ))}
        </Seleccion>
        <Campo
          id={`etapa-inicio-${sufijo}`}
          name="inicio"
          type="date"
          etiqueta="Inicio"
          required
          defaultValue={valor('inicio', etapa?.inicio ?? hoy)}
          error={estado.errores.inicio}
        />
        <Campo
          id={`etapa-fin-${sufijo}`}
          name="fin"
          type="date"
          etiqueta="Fin"
          required
          defaultValue={valor('fin', etapa?.fin ?? '')}
          error={estado.errores.fin}
        />
      </div>
      <BotonEnvio variante="secundario" textoPendiente="Guardando…" className="self-start">
        {etapa === undefined ? 'Agregar etapa' : 'Guardar etapa'}
      </BotonEnvio>
    </form>
  );
}

export function BotonMover({ accion, etiqueta }: { accion: AccionSinDatos; etiqueta: string }): ReactNode {
  const [, accionFormulario] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={accionFormulario}>
      <BotonEnvio variante="sutil" textoPendiente="Moviendo…">
        {etiqueta}
      </BotonEnvio>
    </form>
  );
}

export function FormularioEntregable({ accion, fin }: { accion: AccionFormulario; fin: string }): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const id = useId();
  const reiniciar = estado.exito;

  return (
    <form action={accionFormulario} key={reiniciar ? 'agregado' : 'entregable'} className="flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1">
        <Campo
          id={`${id}-nombre`}
          name="nombre"
          etiqueta="Nuevo entregable"
          required
          maxLength={200}
          defaultValue={reiniciar ? '' : estado.valores.nombre}
          error={estado.errores.nombre}
        />
      </div>
      <div className="w-44">
        <Campo
          id={`${id}-fecha`}
          name="fechaCompromiso"
          type="date"
          etiqueta="Compromiso"
          required
          defaultValue={reiniciar ? fin : (estado.valores.fechaCompromiso ?? fin)}
          error={estado.errores.fechaCompromiso}
        />
      </div>
      <BotonEnvio variante="secundario" textoPendiente="Agregando…">
        Agregar
      </BotonEnvio>
      {estado.mensaje === null || estado.exito ? null : <p className="w-full text-sm text-rojo">{estado.mensaje}</p>}
    </form>
  );
}

export function FormularioEntrega({ accion }: { accion: AccionFormulario }): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const id = useId();

  return (
    <form action={accionFormulario} className="flex flex-col gap-2">
      <MensajeFormulario estado={estado} />
      <label htmlFor={`${id}-archivo`} className="text-sm font-medium text-tinta">
        Archivo del entregable
      </label>
      <input
        id={`${id}-archivo`}
        name="archivo"
        type="file"
        required
        accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.pptx,.doc,.xls"
        className="block w-full text-sm text-apagado file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-marino/10 file:px-4 file:font-semibold file:text-marino hover:file:bg-marino/15"
      />
      <p className="text-xs text-apagado">PDF, imagen u Office, hasta {TAMANO_MAXIMO_ENTREGABLE_MB} MB.</p>
      {estado.errores.archivo === undefined ? null : <p className="text-sm font-medium text-rojo">{estado.errores.archivo}</p>}
      <BotonEnvio variante="secundario" textoPendiente="Subiendo…" className="self-start">
        Entregar
      </BotonEnvio>
    </form>
  );
}

export function FormularioRevisionEntregable({ accion }: { accion: AccionFormulario }): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const id = useId();

  return (
    <form action={accionFormulario} className="flex flex-col gap-2">
      <MensajeFormulario estado={estado} />
      <Seleccion
        id={`${id}-decision`}
        name="decision"
        etiqueta="Decisión"
        defaultValue={estado.valores.decision ?? 'APROBAR'}
        error={estado.errores.decision}
      >
        <option value="APROBAR">Aprobar</option>
        <option value="OBSERVAR">Observar</option>
      </Seleccion>
      <AreaTexto
        id={`${id}-comentario`}
        name="comentario"
        etiqueta="Comentario"
        ayuda="Obligatorio si observa el entregable."
        maxLength={1000}
        defaultValue={estado.valores.comentario}
        error={estado.errores.comentario}
      />
      <BotonEnvio variante="secundario" textoPendiente="Guardando…" className="self-start">
        Registrar revisión
      </BotonEnvio>
    </form>
  );
}
