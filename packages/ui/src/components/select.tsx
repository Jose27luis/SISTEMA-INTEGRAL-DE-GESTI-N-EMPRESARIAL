'use client';

import {
  Children,
  isValidElement,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../cn';
import { CLASES_CONTROL, type DescripcionCampo, Envoltura, idsDescripcion } from './field-base';

const MINIMO_PARA_BUSCAR = 8;
const ALTO_MAXIMO_PANEL = 320;

interface OpcionSeleccion {
  valor: string;
  etiqueta: string;
  deshabilitada: boolean;
}

interface Posicion {
  izquierda: number;
  ancho: number;
  arriba: number | null;
  abajo: number | null;
  altoMaximo: number;
}

export type PropiedadesSeleccion = DescripcionCampo &
  SelectHTMLAttributes<HTMLSelectElement> & {
    buscable?: boolean;
  };

function textoDe(nodo: ReactNode): string {
  if (typeof nodo === 'string' || typeof nodo === 'number') {
    return String(nodo);
  }

  if (Array.isArray(nodo)) {
    return nodo.map(textoDe).join('');
  }

  if (isValidElement<{ children?: ReactNode }>(nodo)) {
    return textoDe(nodo.props.children);
  }

  return '';
}

function extraerOpciones(hijos: ReactNode): OpcionSeleccion[] {
  const opciones: OpcionSeleccion[] = [];

  for (const hijo of Children.toArray(hijos)) {
    if (!isValidElement(hijo)) {
      continue;
    }

    const elemento = hijo as ReactElement<{ value?: unknown; disabled?: boolean; children?: ReactNode }>;

    if (elemento.type === 'option') {
      const etiqueta = textoDe(elemento.props.children);
      const valor = elemento.props.value;
      opciones.push({
        valor: typeof valor === 'string' || typeof valor === 'number' ? String(valor) : etiqueta,
        etiqueta,
        deshabilitada: elemento.props.disabled === true,
      });
    } else {
      opciones.push(...extraerOpciones(elemento.props.children));
    }
  }

  return opciones;
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function asignarValorNativo(elemento: HTMLSelectElement, valor: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  descriptor?.set?.call(elemento, valor);
  elemento.dispatchEvent(new Event('change', { bubbles: true }));
}

function Chevron({ abierto }: { abierto: boolean }): ReactNode {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={cn('size-4 shrink-0 text-apagado transition-transform', abierto && 'rotate-180')}
    >
      <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Marca(): ReactNode {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 shrink-0 text-marino">
      <path d="M4.5 10.5 8.5 14.5 15.5 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Seleccion({
  id,
  etiqueta,
  ayuda,
  error,
  className,
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  required,
  name,
  buscable,
  ...resto
}: PropiedadesSeleccion): ReactNode {
  const opciones = useMemo(() => extraerOpciones(children), [children]);
  const primeraHabilitada = opciones.find(({ deshabilitada }) => !deshabilitada)?.valor ?? '';
  const [interno, setInterno] = useState<string>(
    defaultValue === undefined ? primeraHabilitada : String(defaultValue),
  );
  const actual = value === undefined ? interno : String(value);
  const seleccionada = opciones.find((opcion) => opcion.valor === actual);
  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [activo, setActivo] = useState(-1);
  const [posicion, setPosicion] = useState<Posicion | null>(null);
  const [invalido, setInvalido] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const nativo = useRef<HTMLSelectElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const busqueda = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const tecleado = useRef({ texto: '', hasta: 0 });
  const idLista = useId();
  const conBusqueda = buscable ?? opciones.length >= MINIMO_PARA_BUSCAR;
  const visibles = useMemo(() => {
    const termino = normalizar(filtro.trim());
    return termino === '' ? opciones : opciones.filter(({ etiqueta: texto }) => normalizar(texto).includes(termino));
  }, [opciones, filtro]);

  const calcularPosicion = useCallback((): void => {
    const rect = boton.current?.getBoundingClientRect();

    if (rect === undefined) {
      return;
    }

    const espacioAbajo = window.innerHeight - rect.bottom - 8;
    const espacioArriba = rect.top - 8;
    const haciaArriba = espacioAbajo < 220 && espacioArriba > espacioAbajo;

    setPosicion({
      izquierda: rect.left,
      ancho: rect.width,
      arriba: haciaArriba ? null : rect.bottom + 4,
      abajo: haciaArriba ? window.innerHeight - rect.top + 4 : null,
      altoMaximo: Math.min(ALTO_MAXIMO_PANEL, Math.max(160, haciaArriba ? espacioArriba : espacioAbajo)),
    });
  }, []);

  const cerrar = useCallback((devolverFoco: boolean): void => {
    setAbierto(false);
    setFiltro('');

    if (devolverFoco) {
      boton.current?.focus();
    }
  }, []);

  const abrir = (): void => {
    if (disabled === true) {
      return;
    }

    calcularPosicion();
    const indice = opciones.findIndex((opcion) => opcion.valor === actual);
    setActivo(indice >= 0 ? indice : opciones.findIndex(({ deshabilitada }) => !deshabilitada));
    setAbierto(true);
  };

  const elegir = (opcion: OpcionSeleccion): void => {
    if (opcion.deshabilitada) {
      return;
    }

    setInvalido(false);

    if (value === undefined) {
      setInterno(opcion.valor);
    }

    if (nativo.current !== null && opcion.valor !== actual) {
      asignarValorNativo(nativo.current, opcion.valor);
    }

    cerrar(true);
  };

  useLayoutEffect(() => {
    if (!abierto) {
      return;
    }

    if (conBusqueda) {
      busqueda.current?.focus();
    } else {
      lista.current?.focus();
    }
  }, [abierto, conBusqueda]);

  useEffect(() => {
    if (!abierto) {
      return undefined;
    }

    const alPresionar = (evento: PointerEvent): void => {
      const destino = evento.target as Node;

      if (!boton.current?.contains(destino) && !panel.current?.contains(destino)) {
        cerrar(false);
      }
    };
    const alMover = (): void => {
      calcularPosicion();
    };

    document.addEventListener('pointerdown', alPresionar);
    window.addEventListener('resize', alMover);
    window.addEventListener('scroll', alMover, true);

    return () => {
      document.removeEventListener('pointerdown', alPresionar);
      window.removeEventListener('resize', alMover);
      window.removeEventListener('scroll', alMover, true);
    };
  }, [abierto, calcularPosicion, cerrar]);

  useEffect(() => {
    if (abierto && activo >= 0) {
      document.getElementById(`${idLista}-${String(activo)}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [abierto, activo, idLista]);

  useEffect(() => {
    setActivo(visibles.findIndex(({ deshabilitada }) => !deshabilitada));
  }, [visibles]);

  const mover = (paso: number): void => {
    if (visibles.length === 0) {
      return;
    }

    let indice = activo;

    for (let intento = 0; intento < visibles.length; intento += 1) {
      indice = (indice + paso + visibles.length) % visibles.length;

      if (visibles[indice]?.deshabilitada === false) {
        setActivo(indice);
        return;
      }
    }
  };

  const teclaEnPanel = (evento: KeyboardEvent): void => {
    switch (evento.key) {
      case 'ArrowDown':
        evento.preventDefault();
        mover(1);
        break;
      case 'ArrowUp':
        evento.preventDefault();
        mover(-1);
        break;
      case 'Home':
        if (!conBusqueda) {
          evento.preventDefault();
          setActivo(visibles.findIndex(({ deshabilitada }) => !deshabilitada));
        }
        break;
      case 'End':
        if (!conBusqueda) {
          evento.preventDefault();
          setActivo(visibles.length - 1 - [...visibles].reverse().findIndex(({ deshabilitada }) => !deshabilitada));
        }
        break;
      case 'Enter': {
        evento.preventDefault();
        const opcion = visibles[activo];

        if (opcion !== undefined) {
          elegir(opcion);
        }
        break;
      }
      case 'Escape':
        evento.preventDefault();
        cerrar(true);
        break;
      case 'Tab':
        cerrar(false);
        break;
      default:
        if (!conBusqueda && evento.key.length === 1) {
          const ahora = Date.now();
          tecleado.current = {
            texto: (ahora > tecleado.current.hasta ? '' : tecleado.current.texto) + normalizar(evento.key),
            hasta: ahora + 700,
          };
          const indice = visibles.findIndex(
            ({ etiqueta: texto, deshabilitada }) => !deshabilitada && normalizar(texto).startsWith(tecleado.current.texto),
          );

          if (indice >= 0) {
            setActivo(indice);
          }
        }
    }
  };

  const teclaEnBoton = (evento: KeyboardEvent<HTMLButtonElement>): void => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(evento.key)) {
      evento.preventDefault();
      abrir();
    }
  };

  const errorVisible = error ?? (invalido ? 'Seleccione una opción.' : undefined);
  const sinValor = seleccionada === undefined || (seleccionada.deshabilitada && seleccionada.valor === '');

  return (
    <Envoltura id={id} etiqueta={etiqueta} ayuda={ayuda} error={errorVisible}>
      <div className="relative">
        <select
          ref={nativo}
          name={name}
          required={required}
          disabled={disabled}
          value={actual}
          onChange={onChange ?? (() => undefined)}
          onInvalid={() => {
            setInvalido(true);
          }}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          {...resto}
        >
          {opciones.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor} disabled={opcion.deshabilitada}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>
        <button
          ref={boton}
          id={id}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={abierto}
          aria-controls={abierto ? idLista : undefined}
          aria-invalid={errorVisible !== undefined}
          aria-required={required}
          aria-describedby={idsDescripcion({ id, etiqueta, ayuda, error: errorVisible })}
          disabled={disabled}
          onClick={() => {
            if (abierto) {
              cerrar(false);
            } else {
              abrir();
            }
          }}
          onKeyDown={teclaEnBoton}
          className={cn(
            CLASES_CONTROL,
            'relative flex h-11 items-center justify-between gap-2 text-left shadow-[0_1px_2px_rgb(1_41_93/0.04)] hover:border-marino-claro disabled:cursor-not-allowed disabled:text-apagado',
            abierto && 'border-marino-claro outline-2 outline-offset-1 outline-marino-claro/30',
            errorVisible !== undefined && 'border-rojo',
            className,
          )}
        >
          <span className={cn('truncate', sinValor && 'text-apagado')}>
            {seleccionada === undefined ? 'Seleccione' : seleccionada.etiqueta}
          </span>
          <Chevron abierto={abierto} />
        </button>
      </div>
      {abierto && posicion !== null
        ? createPortal(
            <div
              ref={panel}
              className="fixed z-[60] flex flex-col overflow-hidden rounded-lg border border-borde bg-superficie shadow-[0_12px_32px_rgb(1_41_93/0.18)]"
              style={{
                left: posicion.izquierda,
                width: Math.max(posicion.ancho, 220),
                maxHeight: posicion.altoMaximo,
                ...(posicion.arriba === null ? {} : { top: posicion.arriba }),
                ...(posicion.abajo === null ? {} : { bottom: posicion.abajo }),
              }}
            >
              {conBusqueda ? (
                <div className="border-b border-borde p-2">
                  <input
                    ref={busqueda}
                    type="search"
                    value={filtro}
                    onChange={(evento) => {
                      setFiltro(evento.target.value);
                    }}
                    onKeyDown={teclaEnPanel}
                    role="searchbox"
                    aria-label={`Buscar en ${etiqueta}`}
                    aria-controls={idLista}
                    aria-activedescendant={activo >= 0 ? `${idLista}-${String(activo)}` : undefined}
                    className="h-10 w-full rounded-md border border-borde bg-fondo px-3 text-sm text-tinta focus:border-marino-claro focus:outline-none"
                  />
                </div>
              ) : null}
              <ul
                ref={lista}
                id={idLista}
                role="listbox"
                aria-label={etiqueta}
                tabIndex={-1}
                onKeyDown={conBusqueda ? undefined : teclaEnPanel}
                aria-activedescendant={!conBusqueda && activo >= 0 ? `${idLista}-${String(activo)}` : undefined}
                className="flex-1 overflow-y-auto overscroll-contain py-1 focus:outline-none"
              >
                {visibles.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-apagado">Sin coincidencias.</li>
                ) : (
                  visibles.map((opcion, indice) => {
                    const elegida = opcion.valor === actual;

                    return (
                      <li
                        key={opcion.valor}
                        id={`${idLista}-${String(indice)}`}
                        role="option"
                        aria-selected={elegida}
                        aria-disabled={opcion.deshabilitada}
                        onPointerEnter={() => {
                          if (!opcion.deshabilitada) {
                            setActivo(indice);
                          }
                        }}
                        onClick={() => {
                          elegir(opcion);
                        }}
                        className={cn(
                          'mx-1 flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-tinta',
                          indice === activo && !opcion.deshabilitada && 'bg-marino/8 text-marino',
                          elegida && 'font-semibold text-marino',
                          opcion.deshabilitada && 'cursor-default text-apagado',
                        )}
                      >
                        <span>{opcion.etiqueta}</span>
                        {elegida && !opcion.deshabilitada ? <Marca /> : null}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </Envoltura>
  );
}
