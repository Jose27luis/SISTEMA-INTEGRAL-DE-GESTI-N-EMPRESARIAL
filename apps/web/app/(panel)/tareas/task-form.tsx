'use client';

import { ETIQUETAS_PRIORIDAD, type OpcionesTarea, PRIORIDADES, type TareaDetalle } from '@sige/types';
import { AreaTexto, Campo, Casilla, Seleccion } from '@sige/ui/components';
import { type ReactNode, useActionState, useState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

interface PropiedadesFormularioTarea {
  accion: (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  opciones: OpcionesTarea;
  tarea: TareaDetalle | null;
  fechaHoy: string;
  clienteInicial: string | null;
}

export function FormularioTarea({
  accion,
  opciones,
  tarea,
  fechaHoy,
  clienteInicial,
}: PropiedadesFormularioTarea): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const [responsableId, setResponsableId] = useState(tarea?.responsable.id ?? '');
  const [colaboradorIds, setColaboradorIds] = useState<string[]>(
    tarea?.colaboradores.map(({ id }) => id) ?? [],
  );
  const [requiereAprobacion, setRequiereAprobacion] = useState(tarea?.requiereAprobacion ?? false);
  const [requiereEvidencia, setRequiereEvidencia] = useState(tarea?.requiereEvidencia ?? false);
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

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-base font-semibold text-marino">Qué hay que hacer</legend>
        <Campo
          id="titulo"
          name="titulo"
          etiqueta="Título"
          required
          minLength={3}
          maxLength={200}
          defaultValue={valor('titulo', tarea?.titulo)}
          error={estado.errores.titulo}
        />
        <AreaTexto
          id="instrucciones"
          name="instrucciones"
          etiqueta="Instrucciones"
          ayuda="Detalle el alcance, los documentos involucrados y el criterio de terminado."
          rows={5}
          maxLength={5000}
          defaultValue={valor('instrucciones', tarea?.instrucciones)}
          error={estado.errores.instrucciones}
        />
        <div className="grid gap-4 sm:grid-cols-3">
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
            defaultValue={valor('prioridad', tarea?.prioridad) ?? 'MEDIA'}
            error={estado.errores.prioridad}
          >
            {PRIORIDADES.map((prioridad) => (
              <option key={prioridad} value={prioridad}>
                {ETIQUETAS_PRIORIDAD[prioridad]}
              </option>
            ))}
          </Seleccion>
          <div className="grid grid-cols-2 gap-4 sm:col-span-1">
            <Campo
              id="fechaInicio"
              name="fechaInicio"
              type="date"
              etiqueta="Inicio"
              defaultValue={valor('fechaInicio', tarea?.fechaInicio) ?? fechaHoy}
              error={estado.errores.fechaInicio}
            />
            <Campo
              id="fechaLimite"
              name="fechaLimite"
              type="date"
              etiqueta="Fecha límite"
              required
              defaultValue={valor('fechaLimite', tarea?.fechaLimite)}
              error={estado.errores.fechaLimite}
            />
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
            defaultValue={valor('evidenciaRequerida', tarea?.evidenciaRequerida)}
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
