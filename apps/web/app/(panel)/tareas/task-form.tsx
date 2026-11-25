'use client';

import { ETIQUETAS_PRIORIDAD, type OpcionesTarea, type Plantilla, PRIORIDADES, type TareaDetalle } from '@sige/types';
import { AreaTexto, Campo, Casilla, Seleccion } from '@sige/ui/components';
import { type ReactNode, useActionState, useState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';
import { formatearPlazo } from '@/lib/format';

interface PropiedadesFormularioTarea {
  accion: (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  opciones: OpcionesTarea;
  tarea: TareaDetalle | null;
  fechaHoy: string;
  clienteInicial: string | null;
  plantilla?: Plantilla | null;
  etapaId?: string | null;
}

function sumarDias(fecha: string, dias: number): string {
  const resultado = new Date(`${fecha}T00:00:00Z`);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado.toISOString().slice(0, 10);
}

export function FormularioTarea({
  accion,
  opciones,
  tarea,
  fechaHoy,
  clienteInicial,
  plantilla = null,
  etapaId = null,
}: PropiedadesFormularioTarea): ReactNode {
  const etapaVinculada = tarea?.etapa?.id ?? etapaId;
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const [responsableId, setResponsableId] = useState(tarea?.responsable.id ?? '');
  const [colaboradorIds, setColaboradorIds] = useState<string[]>(
    tarea?.colaboradores.map(({ id }) => id) ?? [],
  );
  const [requiereAprobacion, setRequiereAprobacion] = useState(
    tarea?.requiereAprobacion ?? plantilla?.requiereAprobacion ?? false,
  );
  const [requiereEvidencia, setRequiereEvidencia] = useState(
    tarea?.requiereEvidencia ?? plantilla?.requiereEvidencia ?? false,
  );
  const base =
    tarea ??
    (plantilla === null
      ? null
      : {
          titulo: plantilla.titulo,
          instrucciones: plantilla.instrucciones,
          prioridad: plantilla.prioridad,
          fechaLimite: sumarDias(fechaHoy, plantilla.diasPlazo),
          evidenciaRequerida: plantilla.evidenciaRequerida,
        });
  const valor = (campo: string, actual: string | null | undefined): string | undefined =>
    estado.valores[campo] ?? actual ?? undefined;
  const otrosUsuarios = opciones.usuarios.filter(({ id }) => id !== responsableId);

  const alternarColaborador = (id: string, marcado: boolean): void => {
    setColaboradorIds((actuales) => (marcado ? [...actuales, id] : actuales.filter((actual) => actual !== id)));
  };

  return (
    <form action={accionFormulario} className="flex flex-col gap-6">
      <MensajeFormulario estado={estado} />
      {tarea === null ? null : <input type="hidden" name="version" value={tarea.version} />}
      {tarea === null && plantilla !== null ? <input type="hidden" name="plantillaId" value={plantilla.id} /> : null}
      {etapaVinculada === null ? null : <input type="hidden" name="etapaId" value={etapaVinculada} />}

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-base font-semibold text-marino">Qué hay que hacer</legend>
        <Campo
          id="titulo"
          name="titulo"
          etiqueta="Título"
          required
          minLength={3}
          maxLength={200}
          defaultValue={valor('titulo', base?.titulo)}
          error={estado.errores.titulo}
        />
        <AreaTexto
          id="instrucciones"
          name="instrucciones"
          etiqueta="Instrucciones"
          ayuda="Detalle el alcance, los documentos involucrados y el criterio de terminado."
          rows={5}
          maxLength={5000}
          defaultValue={valor('instrucciones', base?.instrucciones)}
          error={estado.errores.instrucciones}
        />
        {tarea === null ? (
          <AreaTexto
            id="items"
            name="items"
            etiqueta="Lista de verificación (opcional)"
            ayuda="Un paso por línea; el responsable los irá marcando."
            rows={4}
            defaultValue={valor('items', plantilla?.items.join('\n'))}
            error={estado.errores.items}
          />
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Seleccion
            id="clienteId"
            name="clienteId"
            etiqueta="Cliente"
            ayuda="Déjelo como interna si no corresponde a un cliente."
            defaultValue={valor('clienteId', tarea === null ? clienteInicial : (tarea.cliente?.id ?? '')) ?? ''}
            error={estado.errores.clienteId}
          >
            <option value="">Tarea interna</option>
            {opciones.clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nombre}
              </option>
            ))}
          </Seleccion>
          <Seleccion
            id="prioridad"
            name="prioridad"
            etiqueta="Prioridad"
            defaultValue={valor('prioridad', base?.prioridad) ?? 'MEDIA'}
            error={estado.errores.prioridad}
          >
            {PRIORIDADES.map((prioridad) => (
              <option key={prioridad} value={prioridad}>
                {ETIQUETAS_PRIORIDAD[prioridad]}
              </option>
            ))}
          </Seleccion>
          <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-2 lg:grid-cols-4">
            <Campo
              id="fechaInicio"
              name="fechaInicio"
              type="date"
              etiqueta="Inicio"
              defaultValue={valor('fechaInicio', tarea?.fechaInicio) ?? fechaHoy}
              error={estado.errores.fechaInicio}
            />
            <Campo
              id="horaInicio"
              name="horaInicio"
              type="time"
              etiqueta="Hora de inicio"
              ayuda="Opcional."
              defaultValue={valor('horaInicio', tarea?.horaInicio)}
              error={estado.errores.horaInicio}
            />
            {tarea?.seguimiento.estricto === true ? (
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-tinta">Fecha y hora límite</span>
                <input type="hidden" name="fechaLimite" value={tarea.fechaLimite} />
                <input type="hidden" name="horaLimite" value={tarea.horaLimite ?? ''} />
                <span className="flex h-11 items-center rounded-md border border-borde bg-fondo px-3 text-sm text-tinta">
                  {formatearPlazo(tarea.fechaLimite, tarea.horaLimite)}
                </span>
                <span className="text-xs text-apagado">Solo cambia con una prórroga aprobada.</span>
              </div>
            ) : (
              <>
                <Campo
                  id="fechaLimite"
                  name="fechaLimite"
                  type="date"
                  etiqueta="Fecha límite"
                  required
                  defaultValue={valor('fechaLimite', base?.fechaLimite)}
                  error={estado.errores.fechaLimite}
                />
                <Campo
                  id="horaLimite"
                  name="horaLimite"
                  type="time"
                  etiqueta="Hora límite"
                  ayuda="Opcional. Sin hora, vence al final del día."
                  defaultValue={valor('horaLimite', tarea?.horaLimite)}
                  error={estado.errores.horaLimite}
                />
              </>
            )}
          </div>
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-base font-semibold text-marino">Quién participa</legend>
        <Seleccion
          id="responsableId"
          name="responsableId"
          etiqueta="Responsable"
          ayuda="Si la tarea es de un cliente, debe estar asignado a ese cliente."
          required
          value={responsableId}
          onChange={(evento) => {
            const elegido = evento.target.value;
            setResponsableId(elegido);
            setColaboradorIds((actuales) => actuales.filter((id) => id !== elegido));
          }}
          error={estado.errores.responsableId}
        >
          <option value="" disabled>
            Seleccione
          </option>
          {opciones.usuarios.map((usuario) => (
            <option key={usuario.id} value={usuario.id}>
              {usuario.nombre}
            </option>
          ))}
        </Seleccion>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-tinta">Colaboradores</p>
          {otrosUsuarios.length === 0 ? (
            <p className="text-sm text-apagado">No hay más usuarios activos.</p>
          ) : (
            <div className="grid max-h-56 gap-2 overflow-y-auto rounded-md border border-borde p-3 sm:grid-cols-2">
              {otrosUsuarios.map((usuario) => (
                <Casilla
                  key={usuario.id}
                  id={`colaborador-${usuario.id}`}
                  name="colaboradorIds"
                  value={usuario.id}
                  etiqueta={usuario.nombre}
                  checked={colaboradorIds.includes(usuario.id)}
                  onChange={(evento) => {
                    alternarColaborador(usuario.id, evento.target.checked);
                  }}
                />
              ))}
            </div>
          )}
          {estado.errores.colaboradorIds === undefined ? null : (
            <p className="text-sm font-medium text-rojo">{estado.errores.colaboradorIds}</p>
          )}
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-base font-semibold text-marino">Control de calidad</legend>
        <Casilla
          id="requiereAprobacion"
          name="requiereAprobacion"
          etiqueta="Requiere aprobación"
          descripcion="Al terminar, la tarea pasa a revisión antes de cerrarse."
          checked={requiereAprobacion}
          onChange={(evento) => {
            setRequiereAprobacion(evento.target.checked);
          }}
        />
        {requiereAprobacion ? (
          <Seleccion
            id="revisorId"
            name="revisorId"
            etiqueta="Revisor"
            required
            defaultValue={valor('revisorId', tarea?.revisor?.id) ?? ''}
            error={estado.errores.revisorId}
          >
            <option value="" disabled>
              Seleccione
            </option>
            {otrosUsuarios.map((usuario) => (
              <option key={usuario.id} value={usuario.id}>
                {usuario.nombre}
              </option>
            ))}
          </Seleccion>
        ) : null}
        <Casilla
          id="requiereEvidencia"
          name="requiereEvidencia"
          etiqueta="Requiere evidencia"
          descripcion="El responsable debe adjuntar archivos que respalden el trabajo."
          checked={requiereEvidencia}
          onChange={(evento) => {
            setRequiereEvidencia(evento.target.checked);
          }}
        />
        {requiereEvidencia ? (
          <AreaTexto
            id="evidenciaRequerida"
            name="evidenciaRequerida"
            etiqueta="Evidencia esperada"
            ayuda="Por ejemplo: constancia de presentación SUNAT en PDF."
            required
            rows={2}
            maxLength={1000}
            defaultValue={valor('evidenciaRequerida', base?.evidenciaRequerida)}
            error={estado.errores.evidenciaRequerida}
          />
        ) : null}
      </fieldset>

      <BotonEnvio textoPendiente="Guardando…" className="self-start">
        {tarea === null ? 'Asignar tarea' : 'Guardar cambios'}
      </BotonEnvio>
    </form>
  );
}
