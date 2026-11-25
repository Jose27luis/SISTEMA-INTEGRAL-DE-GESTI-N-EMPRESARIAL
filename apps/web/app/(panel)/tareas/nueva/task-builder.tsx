'use client';

import {
  type CargaEquipo,
  ETIQUETAS_PRIORIDAD,
  MAXIMO_RESPONSABLES_LOTE,
  PRIORIDADES,
  type Prioridad,
} from '@sige/types';
import { cn } from '@sige/ui/cn';
import { Alerta, AreaTexto, Campo, CampoFecha, CampoHora, Casilla, Seleccion } from '@sige/ui/components';
import { type ReactNode, useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';
import { formatearFechaHora } from '@/lib/format';
import { EditorListaVerificacion } from './checklist-editor';
import { CalendarioVencimientos } from './due-calendar';
import { type Pendiente, VistaPreviaTarea } from './task-preview';
import { SelectorColaboradores, SelectorEquipo } from './team-picker';

const esquemaBorrador = z.object({
  titulo: z.string(),
  instrucciones: z.string(),
  clienteId: z.string(),
  prioridad: z.enum(PRIORIDADES),
  fechaInicio: z.string(),
  horaInicio: z.string().default(''),
  fechaLimite: z.string(),
  horaLimite: z.string().default(''),
  responsableIds: z.array(z.string()),
  colaboradorIds: z.array(z.string()),
  revisorId: z.string(),
  requiereAprobacion: z.boolean(),
  requiereEvidencia: z.boolean(),
  evidenciaRequerida: z.string(),
  items: z.array(z.string()),
});

export type Borrador = z.output<typeof esquemaBorrador>;

const esquemaGuardado = z.object({ guardadoEn: z.iso.datetime(), datos: esquemaBorrador });

const TONOS_PRIORIDAD: Record<Prioridad, string> = {
  BAJA: 'border-borde bg-fondo text-tinta',
  MEDIA: 'border-marino-claro bg-marino/8 text-marino',
  ALTA: 'border-dorado bg-dorado-suave text-dorado-oscuro',
  URGENTE: 'border-rojo bg-rojo-suave text-rojo',
};

interface PropiedadesConstructor {
  accion: (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  inicial: Borrador;
  origen: 'nuevo' | 'plantilla' | 'duplicado';
  carga: CargaEquipo;
  clientes: readonly { id: string; nombre: string }[];
  plantillaId: string | null;
  etapaId: string | null;
  claveBorrador: string;
}

function Seccion({ numero, titulo, descripcion, children, id }: {
  numero: number;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  id?: string;
}): ReactNode {
  return (
    <section id={id} className="scroll-mt-6 rounded-lg border border-borde bg-superficie p-4 sm:p-6">
      <header className="mb-5 flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-marino text-sm font-bold text-superficie">
          {numero}
        </span>
        <div>
          <h2 className="text-base font-semibold text-marino">{titulo}</h2>
          {descripcion === undefined ? null : <p className="text-sm text-apagado">{descripcion}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function leerGuardado(clave: string): z.infer<typeof esquemaGuardado> | null {
  try {
    const crudo = window.localStorage.getItem(clave);

    if (crudo === null) {
      return null;
    }

    const resultado = esquemaGuardado.safeParse(JSON.parse(crudo));
    return resultado.success ? resultado.data : null;
  } catch {
    return null;
  }
}

function borrarGuardado(clave: string): void {
  try {
    window.localStorage.removeItem(clave);
  } catch {
    return;
  }
}

export function ConstructorTarea({
  accion,
  inicial,
  origen,
  carga,
  clientes,
  plantillaId,
  etapaId,
  claveBorrador,
}: PropiedadesConstructor): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const [datos, setDatos] = useState<Borrador>(inicial);
  const [multiple, setMultiple] = useState(inicial.responsableIds.length > 1);
  const [recuperable, setRecuperable] = useState<z.infer<typeof esquemaGuardado> | null>(null);
  const modificado = useRef(false);
  const nombres = useMemo(() => new Map(carga.personas.map(({ id, nombre }) => [id, nombre])), [carga.personas]);

  useEffect(() => {
    if (origen !== 'nuevo') {
      return;
    }

    const guardado = leerGuardado(claveBorrador);

    if (guardado !== null && JSON.stringify(guardado.datos) !== JSON.stringify(inicial)) {
      setRecuperable(guardado);
    }
  }, [claveBorrador, inicial, origen]);

  useEffect(() => {
    if (!modificado.current) {
      return;
    }

    const temporizador = window.setTimeout(() => {
      try {
        window.localStorage.setItem(claveBorrador, JSON.stringify({ guardadoEn: new Date().toISOString(), datos }));
      } catch {
        return;
      }
    }, 500);

    return () => {
      window.clearTimeout(temporizador);
    };
  }, [claveBorrador, datos]);

  const cambiar = <K extends keyof Borrador>(campo: K, valor: Borrador[K]): void => {
    modificado.current = true;
    setRecuperable(null);
    setDatos((actual) => ({ ...actual, [campo]: valor }));
  };

  const elegirResponsables = (ids: string[]): void => {
    modificado.current = true;
    setRecuperable(null);
    setDatos((actual) => ({
      ...actual,
      responsableIds: ids.slice(0, MAXIMO_RESPONSABLES_LOTE),
      colaboradorIds: actual.colaboradorIds.filter((id) => !ids.includes(id)),
      revisorId: ids.includes(actual.revisorId) ? '' : actual.revisorId,
    }));
  };

  const vencimientos = useMemo(() => {
    const mapa = new Map<string, number>();

    for (const persona of carga.personas) {
      if (datos.responsableIds.includes(persona.id)) {
        for (const { fecha, cantidad } of persona.vencimientos) {
          mapa.set(fecha, (mapa.get(fecha) ?? 0) + cantidad);
        }
      }
    }

    return mapa;
  }, [carga.personas, datos.responsableIds]);

  const nombresResponsables = datos.responsableIds.map((id) => nombres.get(id) ?? '').filter((nombre) => nombre !== '');
  const minimoLimite = datos.fechaInicio !== '' && datos.fechaInicio > carga.hoy ? datos.fechaInicio : carga.hoy;
  const pendientes: Pendiente[] = [
    ...(datos.titulo.trim().length < 3 ? [{ campo: 'titulo', texto: 'Título de al menos 3 caracteres' }] : []),
    ...(datos.responsableIds.length === 0
      ? [{ campo: 'seccion-responsable', texto: 'Responsable' }]
      : multiple && datos.responsableIds.length < 2
        ? [{ campo: 'seccion-responsable', texto: 'Al menos dos responsables, o cambie a una persona' }]
        : []),
    ...(datos.fechaLimite === '' ? [{ campo: 'fechaLimite', texto: 'Fecha límite' }] : []),
    ...(datos.fechaInicio !== '' &&
    datos.fechaInicio === datos.fechaLimite &&
    datos.horaInicio !== '' &&
    datos.horaLimite !== '' &&
    datos.horaInicio >= datos.horaLimite
      ? [{ campo: 'horaLimite', texto: 'Hora límite posterior a la de inicio' }]
      : []),
    ...(datos.requiereAprobacion && datos.revisorId === '' ? [{ campo: 'revisorId', texto: 'Revisor' }] : []),
    ...(datos.requiereEvidencia && datos.evidenciaRequerida.trim() === ''
      ? [{ campo: 'evidenciaRequerida', texto: 'Evidencia esperada' }]
      : []),
  ];
  const errorResponsable = estado.errores.responsableIds ?? estado.errores.responsableId;
  const cantidad = datos.responsableIds.length;

  return (
    <form
      action={accionFormulario}
      onSubmit={() => {
        borrarGuardado(claveBorrador);
        modificado.current = false;
      }}
      className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]"
    >
      {plantillaId === null ? null : <input type="hidden" name="plantillaId" value={plantillaId} />}
      {etapaId === null ? null : <input type="hidden" name="etapaId" value={etapaId} />}
      <input type="hidden" name="prioridad" value={datos.prioridad} />
      {datos.responsableIds.map((id) => (
        <input key={id} type="hidden" name="responsableIds" value={id} />
      ))}
      {datos.colaboradorIds.map((id) => (
        <input key={id} type="hidden" name="colaboradorIds" value={id} />
      ))}
      {datos.items.map((item, indice) => (
        <input key={`${item}-${String(indice)}`} type="hidden" name="items" value={item} />
      ))}

      <div className="flex min-w-0 flex-col gap-6">
        {recuperable === null ? null : (
          <Alerta tono="info" titulo="Hay un borrador sin terminar">
            <span className="mb-3 block">
              Guardado en este navegador el {formatearFechaHora(recuperable.guardadoEn)}
              {recuperable.datos.titulo.trim() === '' ? '' : `: «${recuperable.datos.titulo}»`}.
            </span>
            <span className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setDatos(recuperable.datos);
                  setMultiple(recuperable.datos.responsableIds.length > 1);
                  setRecuperable(null);
                  modificado.current = true;
                }}
                className="inline-flex min-h-9 items-center rounded-md bg-marino px-3 text-sm font-semibold text-superficie hover:bg-marino-medio"
              >
                Recuperar borrador
              </button>
              <button
                type="button"
                onClick={() => {
                  borrarGuardado(claveBorrador);
                  setRecuperable(null);
                }}
                className="inline-flex min-h-9 items-center rounded-md border border-borde bg-superficie px-3 text-sm font-semibold text-marino hover:border-marino-claro"
              >
                Descartar
              </button>
            </span>
          </Alerta>
        )}
        <MensajeFormulario estado={estado} />

        <Seccion numero={1} titulo="Qué hay que hacer">
          <div className="grid gap-4">
            <Campo
              id="titulo"
              name="titulo"
              etiqueta="Título"
              required
              minLength={3}
              maxLength={200}
              value={datos.titulo}
              onChange={(evento) => {
                cambiar('titulo', evento.target.value);
              }}
              error={estado.errores.titulo}
            />
            <AreaTexto
              id="instrucciones"
              name="instrucciones"
              etiqueta="Instrucciones"
              ayuda="Detalle el alcance, los documentos involucrados y el criterio de terminado."
              rows={4}
              maxLength={5000}
              value={datos.instrucciones}
              onChange={(evento) => {
                cambiar('instrucciones', evento.target.value);
              }}
              error={estado.errores.instrucciones}
            />
            <div className="grid gap-4 @container sm:grid-cols-2">
              <Seleccion
                id="clienteId"
                name="clienteId"
                etiqueta="Cliente"
                ayuda="Déjelo como interna si no corresponde a un cliente."
                value={datos.clienteId}
                onChange={(evento) => {
                  cambiar('clienteId', evento.target.value);
                }}
                error={estado.errores.clienteId}
              >
                <option value="">Tarea interna</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombre}
                  </option>
                ))}
              </Seleccion>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1.5 text-sm font-medium text-tinta">Prioridad</legend>
                <div className="grid grid-cols-4 gap-1.5">
                  {PRIORIDADES.map((prioridad) => (
                    <button
                      key={prioridad}
                      type="button"
                      aria-pressed={datos.prioridad === prioridad}
                      onClick={() => {
                        cambiar('prioridad', prioridad);
                      }}
                      className={cn(
                        'min-h-11 rounded-md border px-1 text-xs font-semibold transition-all sm:text-sm',
                        datos.prioridad === prioridad
                          ? cn(TONOS_PRIORIDAD[prioridad], 'shadow-sm ring-2 ring-current/15')
                          : 'border-borde bg-superficie text-apagado hover:border-marino-claro',
                      )}
                    >
                      {ETIQUETAS_PRIORIDAD[prioridad]}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
            <EditorListaVerificacion
              items={datos.items}
              onCambiar={(items) => {
                cambiar('items', items);
              }}
              error={estado.errores.items}
            />
          </div>
        </Seccion>

        <Seccion
          numero={2}
          id="seccion-responsable"
          titulo="Quién lo hace"
          descripcion="La carga incluye todas las tareas abiertas de cada persona."
        >
          <div className="flex flex-col gap-5">
            <div role="radiogroup" aria-label="Modo de asignación" className="inline-flex self-start rounded-lg bg-fondo p-1">
              {[
                { valor: false, etiqueta: 'Una persona' },
                { valor: true, etiqueta: 'Varias personas' },
              ].map((opcion) => (
                <button
                  key={opcion.etiqueta}
                  type="button"
                  role="radio"
                  aria-checked={multiple === opcion.valor}
                  onClick={() => {
                    setMultiple(opcion.valor);

                    if (!opcion.valor) {
                      elegirResponsables(datos.responsableIds.slice(0, 1));
                    }
                  }}
                  className={cn(
                    'min-h-9 rounded-md px-4 text-sm font-semibold transition-colors',
                    multiple === opcion.valor ? 'bg-superficie text-marino shadow-sm' : 'text-apagado hover:text-marino',
                  )}
                >
                  {opcion.etiqueta}
                </button>
              ))}
            </div>
            {multiple ? (
              <p className="-mt-2 text-sm text-apagado">
                Se crea una tarea independiente para cada persona elegida, con el mismo contenido.
              </p>
            ) : null}
            <SelectorEquipo
              personas={carga.personas}
              seleccionados={datos.responsableIds}
              multiple={multiple}
              onCambiar={elegirResponsables}
              error={errorResponsable}
            />
            <SelectorColaboradores
              personas={carga.personas}
              excluidos={datos.responsableIds}
              seleccionados={datos.colaboradorIds}
              onCambiar={(ids) => {
                cambiar('colaboradorIds', ids);
              }}
              error={estado.errores.colaboradorIds}
            />
          </div>
        </Seccion>

        <Seccion numero={3} titulo="Para cuándo" descripcion="Elija la fecha mirando los vencimientos que ya tiene el responsable.">
          <div className="grid gap-5 @container xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,8.5rem)] gap-3">
                <CampoFecha
                  id="fechaInicio"
                  name="fechaInicio"
                  etiqueta="Inicio"
                  value={datos.fechaInicio}
                  onChange={(evento) => {
                    cambiar('fechaInicio', evento.target.value);
                  }}
                  error={estado.errores.fechaInicio}
                />
                <CampoHora
                  id="horaInicio"
                  name="horaInicio"
                  etiqueta="Hora"
                  value={datos.horaInicio}
                  onChange={(evento) => {
                    cambiar('horaInicio', evento.target.value);
                  }}
                  error={estado.errores.horaInicio}
                />
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,8.5rem)] gap-3">
                <CampoFecha
                  id="fechaLimite"
                  name="fechaLimite"
                  etiqueta="Fecha límite"
                  required
                  min={minimoLimite}
                  value={datos.fechaLimite}
                  onChange={(evento) => {
                    cambiar('fechaLimite', evento.target.value);
                  }}
                  error={estado.errores.fechaLimite}
                />
                <CampoHora
                  id="horaLimite"
                  name="horaLimite"
                  etiqueta="Hora límite"
                  value={datos.horaLimite}
                  onChange={(evento) => {
                    cambiar('horaLimite', evento.target.value);
                  }}
                  error={estado.errores.horaLimite}
                />
              </div>
              <p className="-mt-1 text-xs text-apagado">
                Las horas son opcionales. Sin hora límite, la tarea vence al final del día; con hora, se marca vencida
                apenas pasa esa hora.
              </p>
            </div>
            <CalendarioVencimientos
              hoy={carga.hoy}
              minimo={minimoLimite}
              valor={datos.fechaLimite}
              onElegir={(fecha) => {
                cambiar('fechaLimite', fecha);
              }}
              vencimientos={vencimientos}
              nombres={nombresResponsables.length > 2 ? `${String(nombresResponsables.length)} responsables` : nombresResponsables.join(' y ')}
            />
          </div>
        </Seccion>

        <Seccion numero={4} titulo="Control de calidad">
          <div className="grid gap-4">
            <Casilla
              id="requiereAprobacion"
              name="requiereAprobacion"
              etiqueta="Requiere aprobación"
              descripcion="Al terminar, la tarea pasa a revisión antes de cerrarse."
              checked={datos.requiereAprobacion}
              onChange={(evento) => {
                cambiar('requiereAprobacion', evento.target.checked);
              }}
            />
            {datos.requiereAprobacion ? (
              <Seleccion
                id="revisorId"
                name="revisorId"
                etiqueta="Revisor"
                required
                value={datos.revisorId}
                onChange={(evento) => {
                  cambiar('revisorId', evento.target.value);
                }}
                error={estado.errores.revisorId}
              >
                <option value="" disabled>
                  Seleccione
                </option>
                {carga.personas
                  .filter(({ id }) => !datos.responsableIds.includes(id))
                  .map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.nombre}
                    </option>
                  ))}
              </Seleccion>
            ) : null}
            <Casilla
              id="requiereEvidencia"
              name="requiereEvidencia"
              etiqueta="Requiere evidencia"
              descripcion="El responsable debe adjuntar archivos que respalden el trabajo."
              checked={datos.requiereEvidencia}
              onChange={(evento) => {
                cambiar('requiereEvidencia', evento.target.checked);
              }}
            />
            {datos.requiereEvidencia ? (
              <AreaTexto
                id="evidenciaRequerida"
                name="evidenciaRequerida"
                etiqueta="Evidencia esperada"
                ayuda="Por ejemplo: constancia de presentación SUNAT en PDF."
                required
                rows={2}
                maxLength={1000}
                value={datos.evidenciaRequerida}
                onChange={(evento) => {
                  cambiar('evidenciaRequerida', evento.target.value);
                }}
                error={estado.errores.evidenciaRequerida}
              />
            ) : null}
          </div>
        </Seccion>
      </div>

      <aside aria-label="Vista previa" className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <h2 className="text-sm font-semibold tracking-wide text-apagado uppercase">Así la verá el responsable</h2>
        <VistaPreviaTarea
          hoy={carga.hoy}
          pendientes={pendientes}
          datos={{
            titulo: datos.titulo,
            instrucciones: datos.instrucciones,
            cliente: clientes.find(({ id }) => id === datos.clienteId)?.nombre ?? null,
            prioridad: datos.prioridad,
            fechaLimite: datos.fechaLimite,
            horaLimite: datos.horaLimite,
            responsables: nombresResponsables,
            colaboradores: datos.colaboradorIds.map((id) => nombres.get(id) ?? '').filter((nombre) => nombre !== ''),
            revisor: nombres.get(datos.revisorId) ?? null,
            requiereAprobacion: datos.requiereAprobacion,
            requiereEvidencia: datos.requiereEvidencia,
            evidenciaRequerida: datos.evidenciaRequerida,
            items: datos.items,
          }}
        />
        <BotonEnvio textoPendiente="Asignando…" disabled={pendientes.length > 0} className="w-full">
          {cantidad > 1 ? `Asignar ${String(cantidad)} tareas` : 'Asignar tarea'}
        </BotonEnvio>
      </aside>
    </form>
  );
}
