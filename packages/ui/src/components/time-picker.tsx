'use client';

import {
  type InputHTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '../cn';
import { CLASES_CONTROL, type DescripcionCampo, Envoltura, idsDescripcion } from './field-base';
import { asignarValorEntrada, IconoReloj, PanelFlotante, usePanelFlotante } from './floating-panel';

const CENTRO = 120;
const RADIO_EXTERIOR = 94;
const RADIO_INTERIOR = 60;
const PATRON_HORA = /^([01]\d|2[0-3]):[0-5]\d$/u;

export type PropiedadesCampoHora = DescripcionCampo &
  InputHTMLAttributes<HTMLInputElement> & {
    pasoMinutos?: number;
  };

interface Hora {
  hora: number;
  minuto: number;
}

function dos(numero: number): string {
  return String(numero).padStart(2, '0');
}

function leerHora(valor: string): Hora | null {
  if (!PATRON_HORA.test(valor)) {
    return null;
  }

  const [hora, minuto] = valor.split(':').map(Number);
  return { hora: hora ?? 0, minuto: minuto ?? 0 };
}

function aTexto({ hora, minuto }: Hora): string {
  return `${dos(hora)}:${dos(minuto)}`;
}

function punto(indice: number, radio: number, total = 12): { x: number; y: number } {
  const angulo = (indice / total) * Math.PI * 2;
  return { x: CENTRO + radio * Math.sin(angulo), y: CENTRO - radio * Math.cos(angulo) };
}

function franja(hora: number): string {
  if (hora < 12) {
    return 'mañana';
  }

  return hora < 19 ? 'tarde' : 'noche';
}

function Reloj({
  inicial,
  pasoMinutos,
  puedeQuitar,
  alAceptar,
  alQuitar,
  alCancelar,
}: {
  inicial: Hora;
  pasoMinutos: number;
  puedeQuitar: boolean;
  alAceptar: (hora: Hora) => void;
  alQuitar: () => void;
  alCancelar: () => void;
}): ReactNode {
  const [modo, setModo] = useState<'horas' | 'minutos'>('horas');
  const [borrador, setBorrador] = useState<Hora>(inicial);
  const arrastrando = useRef(false);
  const esfera = useRef<SVGSVGElement>(null);

  useEffect(() => {
    esfera.current?.focus();
  }, []);

  const leerPuntero = (evento: PointerEvent<SVGSVGElement>): void => {
    const rect = esfera.current?.getBoundingClientRect();

    if (rect === undefined) {
      return;
    }

    const escala = 240 / rect.width;
    const dx = (evento.clientX - rect.left) * escala - CENTRO;
    const dy = (evento.clientY - rect.top) * escala - CENTRO;
    const angulo = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2);
    const distancia = Math.hypot(dx, dy);

    if (modo === 'horas') {
      const indice = Math.round(angulo / (Math.PI / 6)) % 12;
      const interior = distancia < (RADIO_EXTERIOR + RADIO_INTERIOR) / 2;
      const hora = interior ? (indice === 0 ? 0 : indice + 12) : indice === 0 ? 12 : indice;
      setBorrador((actual) => ({ ...actual, hora }));
    } else {
      const minuto = (Math.round(angulo / (Math.PI / 30) / pasoMinutos) * pasoMinutos) % 60;
      setBorrador((actual) => ({ ...actual, minuto }));
    }
  };

  const tecla = (evento: KeyboardEvent): void => {
    const cambio = evento.key === 'ArrowUp' || evento.key === 'ArrowRight' ? 1 : evento.key === 'ArrowDown' || evento.key === 'ArrowLeft' ? -1 : 0;

    if (cambio !== 0) {
      evento.preventDefault();
      setBorrador((actual) =>
        modo === 'horas'
          ? { ...actual, hora: (actual.hora + cambio + 24) % 24 }
          : { ...actual, minuto: (actual.minuto + cambio * pasoMinutos + 60) % 60 },
      );
    } else if (evento.key === 'Enter') {
      evento.preventDefault();

      if (modo === 'horas') {
        setModo('minutos');
      } else {
        alAceptar(borrador);
      }
    } else if (evento.key === 'Escape') {
      evento.preventDefault();
      alCancelar();
    }
  };

  const seleccion =
    modo === 'horas'
      ? punto(borrador.hora % 12, borrador.hora === 0 || borrador.hora > 12 ? RADIO_INTERIOR : RADIO_EXTERIOR)
      : punto(borrador.minuto, RADIO_EXTERIOR, 60);

  return (
    <div className="flex flex-col items-center gap-3" onKeyDown={tecla}>
      <div className="flex w-full items-end justify-center gap-1 rounded-lg bg-marino px-4 py-3 text-white">
        {(['horas', 'minutos'] as const).map((segmento, indice) => (
          <span key={segmento} className="flex items-end">
            {indice === 1 ? <span className="pb-1 font-display text-4xl leading-none text-white/60">:</span> : null}
            <button
              type="button"
              aria-pressed={modo === segmento}
              onClick={() => {
                setModo(segmento);
              }}
              className={cn(
                'rounded-md px-2 font-display text-4xl leading-tight font-semibold tabular-nums transition-colors',
                modo === segmento ? 'bg-white/15 text-dorado' : 'text-white/80 hover:bg-white/10',
              )}
            >
              {dos(segmento === 'horas' ? borrador.hora : borrador.minuto)}
            </button>
          </span>
        ))}
        <span className="mb-1.5 ml-2 text-xs font-semibold text-white/70 uppercase">{franja(borrador.hora)}</span>
      </div>

      <svg
        ref={esfera}
        viewBox="0 0 240 240"
        role="slider"
        tabIndex={0}
        aria-label={modo === 'horas' ? 'Hora' : 'Minutos'}
        aria-valuemin={0}
        aria-valuemax={modo === 'horas' ? 23 : 59}
        aria-valuenow={modo === 'horas' ? borrador.hora : borrador.minuto}
        aria-valuetext={aTexto(borrador)}
        className="size-60 touch-none rounded-full select-none focus:outline-2 focus:outline-offset-2 focus:outline-marino-claro"
        onPointerDown={(evento) => {
          arrastrando.current = true;
          evento.currentTarget.setPointerCapture(evento.pointerId);
          leerPuntero(evento);
        }}
        onPointerMove={(evento) => {
          if (arrastrando.current) {
            leerPuntero(evento);
          }
        }}
        onPointerUp={() => {
          arrastrando.current = false;

          if (modo === 'horas') {
            setModo('minutos');
          }
        }}
      >
        <circle cx={CENTRO} cy={CENTRO} r={118} className="fill-fondo" />
        <line x1={CENTRO} y1={CENTRO} x2={seleccion.x} y2={seleccion.y} className="stroke-marino" strokeWidth={2} />
        <circle cx={CENTRO} cy={CENTRO} r={4} className="fill-marino" />
        <circle cx={seleccion.x} cy={seleccion.y} r={17} className="fill-marino" />
        {modo === 'horas'
          ? Array.from({ length: 12 }, (_, indice) => {
              const exterior = indice === 0 ? 12 : indice;
              const interior = indice === 0 ? 0 : indice + 12;

              return [
                { valor: exterior, radio: RADIO_EXTERIOR, clase: 'text-[15px] font-semibold' },
                { valor: interior, radio: RADIO_INTERIOR, clase: 'text-[12px]' },
              ].map(({ valor, radio, clase }) => {
                const { x, y } = punto(indice, radio);
                const elegido = valor === borrador.hora;

                return (
                  <text
                    key={valor}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className={cn('pointer-events-none tabular-nums', clase, elegido ? 'fill-white' : radio === RADIO_EXTERIOR ? 'fill-tinta' : 'fill-apagado')}
                  >
                    {radio === RADIO_INTERIOR ? dos(valor) : valor}
                  </text>
                );
              });
            })
          : Array.from({ length: 12 }, (_, indice) => {
              const valor = indice * 5;
              const { x, y } = punto(valor, RADIO_EXTERIOR, 60);

              return (
                <text
                  key={valor}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={cn(
                    'pointer-events-none text-[15px] font-semibold tabular-nums',
                    valor === borrador.minuto ? 'fill-white' : 'fill-tinta',
                  )}
                >
                  {dos(valor)}
                </text>
              );
            })}
      </svg>

      <p className="text-xs text-apagado">
        {modo === 'horas' ? 'Anillo exterior: 1 a 12 · interior: 13 a 00' : 'Arrastre la aguja o use las flechas'}
      </p>

      <div className="flex w-full items-center justify-between gap-2 border-t border-borde pt-3">
        {puedeQuitar ? (
          <button type="button" onClick={alQuitar} className="min-h-9 rounded-md px-3 text-sm font-semibold text-apagado hover:bg-fondo">
            Quitar
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" onClick={alCancelar} className="min-h-9 rounded-md px-3 text-sm font-semibold text-apagado hover:bg-fondo">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              alAceptar(borrador);
            }}
            className="min-h-9 rounded-md bg-marino px-4 text-sm font-semibold text-white hover:bg-marino-medio"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}

export function CampoHora({
  id,
  etiqueta,
  ayuda,
  error,
  className,
  value,
  defaultValue,
  onChange,
  required,
  disabled,
  name,
  pasoMinutos = 5,
  ...resto
}: PropiedadesCampoHora): ReactNode {
  const entrada = useRef<HTMLInputElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const [interno, setInterno] = useState(typeof defaultValue === 'string' && PATRON_HORA.test(defaultValue) ? defaultValue : '');
  const actual = typeof value === 'string' ? value : interno;
  const [abierto, setAbierto] = useState(false);
  const [invalido, setInvalido] = useState(false);
  const cerrar = useCallback((): void => {
    setAbierto(false);
  }, []);
  const { posicion, panel } = usePanelFlotante(boton, abierto, cerrar, { anchoMinimo: 288, altoDeseado: 470 });
  const errorVisible = error ?? (invalido ? 'Elija una hora.' : undefined);

  const cambiar = (nuevo: string): void => {
    setInvalido(false);

    if (value === undefined) {
      setInterno(nuevo);
    }

    if (entrada.current !== null && nuevo !== actual) {
      asignarValorEntrada(entrada.current, nuevo);
    }

    setAbierto(false);
    boton.current?.focus();
  };

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
            setAbierto(!abierto);
          }}
          className={cn(
            CLASES_CONTROL,
            'relative flex h-11 items-center justify-between gap-2 text-left tabular-nums hover:border-marino-claro disabled:cursor-not-allowed disabled:text-apagado',
            abierto && 'border-marino-claro outline-2 outline-offset-1 outline-marino-claro/30',
            errorVisible !== undefined && 'border-rojo',
            className,
          )}
        >
          <span className={cn(actual === '' && 'text-apagado')}>{actual === '' ? 'Sin hora' : actual}</span>
          <IconoReloj />
        </button>
      </div>
      {abierto ? (
        <PanelFlotante posicion={posicion} panel={panel} etiqueta={`Reloj de ${etiqueta}`}>
          <Reloj
            inicial={leerHora(actual) ?? { hora: 8, minuto: 0 }}
            pasoMinutos={pasoMinutos}
            puedeQuitar={required !== true && actual !== ''}
            alAceptar={(hora) => {
              cambiar(aTexto(hora));
            }}
            alQuitar={() => {
              cambiar('');
            }}
            alCancelar={() => {
              setAbierto(false);
              boton.current?.focus();
            }}
          />
        </PanelFlotante>
      ) : null}
    </Envoltura>
  );
}
