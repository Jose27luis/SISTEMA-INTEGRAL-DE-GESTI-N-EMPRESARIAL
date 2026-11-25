'use client';

import {
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '../cn';
import { CLASES_CONTROL, type DescripcionCampo, Envoltura, idsDescripcion } from './field-base';
import { asignarValorEntrada, Flecha, IconoCalendario, PanelFlotante, usePanelFlotante } from './floating-panel';

export const NOMBRES_MES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'setiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const DIAS_SEMANA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const NOMBRES_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/u;
const PATRON_MES = /^\d{4}-\d{2}$/u;

export type PropiedadesCampoFecha = DescripcionCampo & InputHTMLAttributes<HTMLInputElement>;

function dos(numero: number): string {
  return String(numero).padStart(2, '0');
}

function aIso(anio: number, mes: number, dia: number): string {
  const fecha = new Date(Date.UTC(anio, mes, dia));
  return `${String(fecha.getUTCFullYear())}-${dos(fecha.getUTCMonth() + 1)}-${dos(fecha.getUTCDate())}`;
}

function partes(iso: string): { anio: number; mes: number; dia: number } {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return { anio: anio ?? 2000, mes: (mes ?? 1) - 1, dia: dia ?? 1 };
}

function sumarDias(iso: string, dias: number): string {
  const { anio, mes, dia } = partes(iso);
  return aIso(anio, mes, dia + dias);
}

function sumarMeses(iso: string, meses: number): string {
  const { anio, mes, dia } = partes(iso);
  const ultimo = new Date(Date.UTC(anio, mes + meses + 1, 0)).getUTCDate();
  return aIso(anio, mes + meses, Math.min(dia, ultimo));
}

function hoyLocal(): string {
  const ahora = new Date();
  return `${String(ahora.getFullYear())}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;
}

function textoLimite(valor: unknown): string | null {
  return typeof valor === 'string' && valor !== '' ? valor : null;
}

function fueraDeRango(iso: string, minimo: string | null, maximo: string | null): boolean {
  return (minimo !== null && iso < minimo.slice(0, iso.length)) || (maximo !== null && iso > maximo.slice(0, iso.length));
}

function formatearFecha(iso: string): string {
  const { anio, mes, dia } = partes(iso);
  const semana = new Date(Date.UTC(anio, mes, dia)).getUTCDay();
  return `${(NOMBRES_DIA[semana] ?? '').slice(0, 3)} ${dos(dia)}/${dos(mes + 1)}/${String(anio)}`;
}

function formatearMes(valor: string): string {
  const [anio, mes] = valor.split('-').map(Number);
  const nombre = NOMBRES_MES[(mes ?? 1) - 1] ?? '';
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${String(anio ?? '')}`;
}

function useValorCampo(
  value: unknown,
  defaultValue: unknown,
  patron: RegExp,
): [string, (valor: string) => void, RefObject<HTMLInputElement | null>] {
  const entrada = useRef<HTMLInputElement>(null);
  const [interno, setInterno] = useState(typeof defaultValue === 'string' && patron.test(defaultValue) ? defaultValue : '');
  const actual = typeof value === 'string' ? value : interno;
  const cambiar = useCallback(
    (nuevo: string): void => {
      if (value === undefined) {
        setInterno(nuevo);
      }

      if (entrada.current !== null && nuevo !== actual) {
        asignarValorEntrada(entrada.current, nuevo);
      }
    },
    [value, actual],
  );

  return [actual, cambiar, entrada];
}

function BotonNavegacion({
  direccion,
  etiqueta,
  alPulsar,
  deshabilitado = false,
}: {
  direccion: 'izquierda' | 'derecha';
  etiqueta: string;
  alPulsar: () => void;
  deshabilitado?: boolean;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={alPulsar}
      disabled={deshabilitado}
      aria-label={etiqueta}
      className="inline-flex size-9 items-center justify-center rounded-md text-marino hover:bg-marino/8 disabled:cursor-not-allowed disabled:opacity-30"
    >
      <Flecha direccion={direccion} />
    </button>
  );
}

function CuadriculaMeses({
  anio,
  seleccionado,
  minimo,
  maximo,
  alElegir,
}: {
  anio: number;
  seleccionado: string | null;
  minimo: string | null;
  maximo: string | null;
  alElegir: (mes: number) => void;
}): ReactNode {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {NOMBRES_MES.map((nombre, indice) => {
        const valor = `${String(anio)}-${dos(indice + 1)}`;
        const elegido = seleccionado === valor;
        const deshabilitado = fueraDeRango(valor, minimo, maximo);

        return (
          <button
            key={nombre}
            type="button"
            disabled={deshabilitado}
            aria-pressed={elegido}
            onClick={() => {
              alElegir(indice);
            }}
            className={cn(
              'h-11 rounded-md text-sm font-semibold capitalize transition-colors',
              elegido ? 'bg-marino text-white' : 'text-tinta hover:bg-marino/8 hover:text-marino',
              deshabilitado && 'cursor-not-allowed text-apagado/50 hover:bg-transparent',
            )}
          >
            {nombre.slice(0, 3)}
          </button>
        );
      })}
    </div>
  );
}

export function CampoFecha({
  id,
  etiqueta,
  ayuda,
  error,
  className,
  value,
  defaultValue,
  onChange,
  min,
  max,
  required,
  disabled,
  name,
  ...resto
}: PropiedadesCampoFecha): ReactNode {
  const [actual, cambiar, entrada] = useValorCampo(value, defaultValue, PATRON_FECHA);
  const minimo = textoLimite(min);
  const maximo = textoLimite(max);
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<'dias' | 'meses' | 'anios'>('dias');
  const [foco, setFoco] = useState(actual === '' ? hoyLocal() : actual);
  const [invalido, setInvalido] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const cerrar = useCallback((): void => {
    setAbierto(false);
  }, []);
  const { posicion, panel } = usePanelFlotante(boton, abierto, cerrar, { anchoMinimo: 296, altoDeseado: 360 });
  const hoy = hoyLocal();
  const { anio, mes } = partes(foco);

  const panelListo = posicion !== null;

  useEffect(() => {
    if (abierto && panelListo && vista === 'dias') {
      panel.current?.querySelector<HTMLButtonElement>(`[data-fecha="${foco}"]`)?.focus();
    }
  }, [abierto, panelListo, vista, foco, panel]);

  const abrir = (): void => {
    if (disabled === true) {
      return;
    }

    setFoco(actual === '' ? (maximo !== null && hoy > maximo ? maximo : hoy) : actual);
    setVista('dias');
    setAbierto(true);
  };

  const elegir = (iso: string): void => {
    if (fueraDeRango(iso, minimo, maximo)) {
      return;
    }

    setInvalido(false);
    cambiar(iso);
    setAbierto(false);
    boton.current?.focus();
  };

  const teclaEnDias = (evento: KeyboardEvent): void => {
    const movimientos: Record<string, () => string> = {
      ArrowLeft: () => sumarDias(foco, -1),
      ArrowRight: () => sumarDias(foco, 1),
      ArrowUp: () => sumarDias(foco, -7),
      ArrowDown: () => sumarDias(foco, 7),
      PageUp: () => sumarMeses(foco, evento.shiftKey ? -12 : -1),
      PageDown: () => sumarMeses(foco, evento.shiftKey ? 12 : 1),
    };
    const mover = movimientos[evento.key];

    if (mover !== undefined) {
      evento.preventDefault();
      setFoco(mover());
    } else if (evento.key === 'Escape') {
      evento.preventDefault();
      setAbierto(false);
      boton.current?.focus();
    }
  };

  const primerDia = new Date(Date.UTC(anio, mes, 1)).getUTCDay();
  const desplazamiento = (primerDia + 6) % 7;
  const celdas = Array.from({ length: 42 }, (_, indice) => aIso(anio, mes, indice - desplazamiento + 1));
  const inicioDecada = anio - (anio % 12);
  const errorVisible = error ?? (invalido ? 'Elija una fecha.' : undefined);

  return (
    <Envoltura id={id} etiqueta={etiqueta} ayuda={ayuda} error={errorVisible}>
      <div className="relative">
        <input
          ref={entrada}
          type="text"
          name={name}
          value={actual}
          required={required}
          disabled={disabled}
          onChange={onChange ?? (() => undefined)}
          onInvalid={() => {
            setInvalido(true);
          }}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          {...resto}
        />
        <button
          ref={boton}
          id={id}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={abierto}
          aria-invalid={errorVisible !== undefined}
          aria-required={required}
          aria-describedby={idsDescripcion({ id, etiqueta, ayuda, error: errorVisible })}
          disabled={disabled}
          onClick={() => {
            if (abierto) {
              cerrar();
            } else {
              abrir();
            }
          }}
          onKeyDown={(evento) => {
            if (evento.key === 'ArrowDown') {
              evento.preventDefault();
              abrir();
            }
          }}
          className={cn(
            CLASES_CONTROL,
            'relative flex h-11 items-center justify-between gap-2 text-left hover:border-marino-claro disabled:cursor-not-allowed disabled:text-apagado',
            abierto && 'border-marino-claro outline-2 outline-offset-1 outline-marino-claro/30',
            errorVisible !== undefined && 'border-rojo',
            className,
          )}
        >
          <span className={cn('truncate', actual === '' && 'text-apagado')}>{actual === '' ? 'Sin fecha' : formatearFecha(actual)}</span>
          <IconoCalendario />
        </button>
      </div>
      {abierto ? (
        <PanelFlotante posicion={posicion} panel={panel} etiqueta={`Calendario de ${etiqueta}`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <BotonNavegacion
              direccion="izquierda"
              etiqueta={vista === 'dias' ? 'Mes anterior' : vista === 'meses' ? 'Año anterior' : 'Años anteriores'}
              alPulsar={() => {
                setFoco(sumarMeses(foco, vista === 'dias' ? -1 : vista === 'meses' ? -12 : -144));
              }}
            />
            <button
              type="button"
              onClick={() => {
                setVista(vista === 'dias' ? 'meses' : vista === 'meses' ? 'anios' : 'dias');
              }}
              aria-live="polite"
              className="min-h-9 flex-1 rounded-md px-2 text-sm font-semibold text-marino capitalize hover:bg-marino/8"
            >
              {vista === 'dias'
                ? `${NOMBRES_MES[mes] ?? ''} ${String(anio)}`
                : vista === 'meses'
                  ? String(anio)
                  : `${String(inicioDecada)} – ${String(inicioDecada + 11)}`}
            </button>
            <BotonNavegacion
              direccion="derecha"
              etiqueta={vista === 'dias' ? 'Mes siguiente' : vista === 'meses' ? 'Año siguiente' : 'Años siguientes'}
              alPulsar={() => {
                setFoco(sumarMeses(foco, vista === 'dias' ? 1 : vista === 'meses' ? 12 : 144));
              }}
            />
          </div>

          {vista === 'dias' ? (
            <div role="grid" aria-label={`${NOMBRES_MES[mes] ?? ''} ${String(anio)}`} onKeyDown={teclaEnDias}>
              <div role="row" className="mb-1 grid grid-cols-7">
                {DIAS_SEMANA.map((dia) => (
                  <span key={dia} role="columnheader" className="py-1 text-center text-xs font-semibold text-apagado">
                    {dia}
                  </span>
                ))}
              </div>
              {Array.from({ length: 6 }, (_, fila) => (
                <div key={fila} role="row" className="grid grid-cols-7 gap-0.5">
                  {celdas.slice(fila * 7, fila * 7 + 7).map((iso) => {
                    const delMes = partes(iso).mes === mes;
                    const elegida = iso === actual;
                    const esHoy = iso === hoy;
                    const deshabilitada = fueraDeRango(iso, minimo, maximo);

                    return (
                      <button
                        key={iso}
                        type="button"
                        role="gridcell"
                        data-fecha={iso}
                        tabIndex={iso === foco ? 0 : -1}
                        aria-selected={elegida}
                        aria-disabled={deshabilitada}
                        aria-label={formatearFecha(iso)}
                        onClick={() => {
                          elegir(iso);
                        }}
                        onFocus={() => {
                          setFoco(iso);
                        }}
                        className={cn(
                          'relative flex h-10 items-center justify-center rounded-md text-sm tabular-nums transition-colors focus:outline-2 focus:outline-offset-1 focus:outline-marino-claro',
                          delMes ? 'text-tinta' : 'text-apagado/60',
                          !elegida && !deshabilitada && 'hover:bg-marino/8 hover:text-marino',
                          esHoy && !elegida && 'font-semibold text-marino ring-1 ring-dorado ring-inset',
                          elegida && 'bg-marino font-semibold text-white',
                          deshabilitada && 'cursor-not-allowed text-apagado/40 line-through',
                        )}
                      >
                        {partes(iso).dia}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : vista === 'meses' ? (
            <CuadriculaMeses
              anio={anio}
              seleccionado={actual === '' ? null : actual.slice(0, 7)}
              minimo={minimo}
              maximo={maximo}
              alElegir={(indice) => {
                setFoco(aIso(anio, indice, Math.min(partes(foco).dia, 28)));
                setVista('dias');
              }}
            />
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 12 }, (_, indice) => inicioDecada + indice).map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  aria-pressed={opcion === anio}
                  onClick={() => {
                    setFoco(aIso(opcion, mes, Math.min(partes(foco).dia, 28)));
                    setVista('meses');
                  }}
                  className={cn(
                    'h-11 rounded-md text-sm font-semibold tabular-nums transition-colors',
                    opcion === anio ? 'bg-marino text-white' : 'text-tinta hover:bg-marino/8 hover:text-marino',
                  )}
                >
                  {opcion}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-borde pt-3">
            {required === true || actual === '' ? (
              <span />
            ) : (
              <button
                type="button"
                onClick={() => {
                  cambiar('');
                  setAbierto(false);
                  boton.current?.focus();
                }}
                className="min-h-9 rounded-md px-3 text-sm font-semibold text-apagado hover:bg-fondo"
              >
                Quitar fecha
              </button>
            )}
            <button
              type="button"
              disabled={fueraDeRango(hoy, minimo, maximo)}
              onClick={() => {
                elegir(hoy);
              }}
              className="min-h-9 rounded-md bg-marino/8 px-3 text-sm font-semibold text-marino hover:bg-marino/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Hoy
            </button>
          </div>
        </PanelFlotante>
      ) : null}
    </Envoltura>
  );
}

export function CampoMes({
  id,
  etiqueta,
  ayuda,
  error,
  className,
  value,
  defaultValue,
  onChange,
  min,
  max,
  required,
  disabled,
  name,
  ...resto
}: PropiedadesCampoFecha): ReactNode {
  const [actual, cambiar, entrada] = useValorCampo(value, defaultValue, PATRON_MES);
  const minimo = textoLimite(min);
  const maximo = textoLimite(max);
  const [abierto, setAbierto] = useState(false);
  const [anio, setAnio] = useState(Number((actual === '' ? hoyLocal() : actual).slice(0, 4)));
  const [invalido, setInvalido] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const cerrar = useCallback((): void => {
    setAbierto(false);
  }, []);
  const { posicion, panel } = usePanelFlotante(boton, abierto, cerrar, { anchoMinimo: 264, altoDeseado: 260 });
  const errorVisible = error ?? (invalido ? 'Elija un mes.' : undefined);

  return (
    <Envoltura id={id} etiqueta={etiqueta} ayuda={ayuda} error={errorVisible}>
      <div className="relative">
        <input
          ref={entrada}
          type="text"
          name={name}
          value={actual}
          required={required}
          disabled={disabled}
          onChange={onChange ?? (() => undefined)}
          onInvalid={() => {
            setInvalido(true);
          }}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          {...resto}
        />
        <button
          ref={boton}
          id={id}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={abierto}
          aria-invalid={errorVisible !== undefined}
          aria-describedby={idsDescripcion({ id, etiqueta, ayuda, error: errorVisible })}
          disabled={disabled}
          onClick={() => {
            if (abierto) {
              cerrar();
            } else {
              setAnio(Number((actual === '' ? hoyLocal() : actual).slice(0, 4)));
              setAbierto(true);
            }
          }}
          className={cn(
            CLASES_CONTROL,
            'relative flex h-11 items-center justify-between gap-2 text-left hover:border-marino-claro disabled:cursor-not-allowed disabled:text-apagado',
            abierto && 'border-marino-claro outline-2 outline-offset-1 outline-marino-claro/30',
            errorVisible !== undefined && 'border-rojo',
            className,
          )}
        >
          <span className={cn('truncate', actual === '' && 'text-apagado')}>{actual === '' ? 'Sin mes' : formatearMes(actual)}</span>
          <IconoCalendario />
        </button>
      </div>
      {abierto ? (
        <PanelFlotante posicion={posicion} panel={panel} etiqueta={`Meses de ${etiqueta}`}>
          <div
            className="mb-2 flex items-center justify-between gap-2"
            onKeyDown={(evento) => {
              if (evento.key === 'Escape') {
                setAbierto(false);
                boton.current?.focus();
              }
            }}
          >
            <BotonNavegacion
              direccion="izquierda"
              etiqueta="Año anterior"
              alPulsar={() => {
                setAnio(anio - 1);
              }}
            />
            <span className="text-sm font-semibold text-marino tabular-nums" aria-live="polite">
              {anio}
            </span>
            <BotonNavegacion
              direccion="derecha"
              etiqueta="Año siguiente"
              alPulsar={() => {
                setAnio(anio + 1);
              }}
            />
          </div>
          <CuadriculaMeses
            anio={anio}
            seleccionado={actual === '' ? null : actual}
            minimo={minimo}
            maximo={maximo}
            alElegir={(indice) => {
              setInvalido(false);
              cambiar(`${String(anio)}-${dos(indice + 1)}`);
              setAbierto(false);
              boton.current?.focus();
            }}
          />
          {required === true || actual === '' ? null : (
            <div className="mt-3 border-t border-borde pt-3">
              <button
                type="button"
                onClick={() => {
                  cambiar('');
                  setAbierto(false);
                  boton.current?.focus();
                }}
                className="min-h-9 rounded-md px-3 text-sm font-semibold text-apagado hover:bg-fondo"
              >
                Quitar mes
              </button>
            </div>
          )}
        </PanelFlotante>
      ) : null}
    </Envoltura>
  );
}
