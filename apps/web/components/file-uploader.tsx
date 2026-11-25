'use client';

import {
  ACEPTAR_SUBIDA,
  EXTENSIONES_SUBIDA,
  extensionDeNombre,
  esquemaSubida,
  esquemaSubidaCompleta,
  type SubidaCompleta,
  TAMANO_MAXIMO_SUBIDA_MB,
} from '@sige/types';
import { cn } from '@sige/ui/cn';
import { CheckCircle2, CloudUpload, LoaderCircle, RotateCw, X } from 'lucide-react';
import { type DragEvent, type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { formatearTamano } from '@/lib/format';
import { IconoArchivo } from './file-icon';

const CABECERAS = { 'x-sige-subida': '1' };
const REINTENTOS = 5;
const SIMULTANEOS = 2;
const LIMITE_BYTES = TAMANO_MAXIMO_SUBIDA_MB * 1024 * 1024;

type EstadoCarga = 'en-cola' | 'subiendo' | 'verificando' | 'lista' | 'error';

interface Carga {
  clave: string;
  archivo: File;
  estado: EstadoCarga;
  enviados: number;
  velocidad: number;
  subidaId: string | null;
  mensaje: string | null;
}

class ErrorSubida extends Error {
  constructor(
    mensaje: string,
    readonly estado: number,
    readonly recuperable: boolean,
  ) {
    super(mensaje);
  }
}

async function leerError(respuesta: Response): Promise<string> {
  try {
    const cuerpo = (await respuesta.json()) as { mensaje?: unknown; errores?: { mensaje?: unknown }[] };
    const detalle = cuerpo.errores?.[0]?.mensaje;
    return typeof detalle === 'string' && respuesta.status !== 409
      ? detalle
      : typeof cuerpo.mensaje === 'string'
        ? cuerpo.mensaje
        : 'No se pudo subir el archivo.';
  } catch {
    return 'No se pudo subir el archivo.';
  }
}

function enviarParte(
  url: string,
  contenido: Blob,
  alAvanzar: (bytes: number) => void,
  senal: AbortSignal,
): Promise<number> {
  return new Promise((resolver, rechazar) => {
    const solicitud = new XMLHttpRequest();
    solicitud.open('PUT', url);
    solicitud.setRequestHeader('content-type', 'application/octet-stream');
    solicitud.setRequestHeader('x-sige-subida', '1');
    solicitud.upload.onprogress = (evento) => {
      alAvanzar(evento.loaded);
    };
    solicitud.onload = () => {
      if (solicitud.status >= 200 && solicitud.status < 300) {
        const datos = esquemaSubida.safeParse(JSON.parse(solicitud.responseText));
        resolver(datos.success ? datos.data.recibidos : -1);
      } else {
        rechazar(new ErrorSubida(`Error ${String(solicitud.status)}`, solicitud.status, solicitud.status >= 500 || solicitud.status === 409));
      }
    };
    solicitud.onerror = () => {
      rechazar(new ErrorSubida('Se perdió la conexión.', 0, true));
    };
    senal.addEventListener('abort', () => {
      solicitud.abort();
      rechazar(new ErrorSubida('Cancelada.', 0, false));
    });
    solicitud.send(contenido);
  });
}

async function esperar(milisegundos: number): Promise<void> {
  await new Promise((resolver) => setTimeout(resolver, milisegundos));
}

async function subirArchivo(
  archivo: File,
  alAvanzar: (enviados: number) => void,
  senal: AbortSignal,
): Promise<SubidaCompleta> {
  const inicio = await fetch('/subidas', {
    method: 'POST',
    headers: { ...CABECERAS, 'content-type': 'application/json' },
    body: JSON.stringify({ nombre: archivo.name, tamanoBytes: archivo.size }),
    signal: senal,
  });

  if (!inicio.ok) {
    throw new ErrorSubida(await leerError(inicio), inicio.status, false);
  }

  const subida = esquemaSubida.parse(await inicio.json());
  let desde = subida.recibidos;
  let fallos = 0;

  while (desde < archivo.size) {
    const hasta = Math.min(desde + subida.tamanoParte, archivo.size);

    try {
      const recibidos = await enviarParte(
        `/subidas/${subida.id}/partes?desde=${String(desde)}`,
        archivo.slice(desde, hasta),
        (bytes) => {
          alAvanzar(desde + bytes);
        },
        senal,
      );
      desde = recibidos >= 0 ? recibidos : hasta;
      fallos = 0;
    } catch (error) {
      if (!(error instanceof ErrorSubida) || !error.recuperable || fallos >= REINTENTOS) {
        throw error instanceof ErrorSubida ? error : new ErrorSubida('No se pudo subir el archivo.', 0, false);
      }

      fallos += 1;
      await esperar(500 * 2 ** fallos);
      const estado = await fetch(`/subidas/${subida.id}`, { signal: senal });

      if (estado.ok) {
        desde = esquemaSubida.parse(await estado.json()).recibidos;
      }
    }

    alAvanzar(desde);
  }

  const final = await fetch(`/subidas/${subida.id}/finalizar`, { method: 'POST', headers: CABECERAS, signal: senal });

  if (!final.ok) {
    throw new ErrorSubida(await leerError(final), final.status, false);
  }

  return esquemaSubidaCompleta.parse(await final.json());
}

function validar(archivo: File): string | null {
  if (!(EXTENSIONES_SUBIDA as readonly string[]).includes(extensionDeNombre(archivo.name))) {
    return 'Formato no admitido.';
  }

  if (archivo.size === 0) {
    return 'El archivo está vacío.';
  }

  return archivo.size > LIMITE_BYTES ? `Supera ${String(TAMANO_MAXIMO_SUBIDA_MB)} MB.` : null;
}

function formatearSegundos(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos <= 0) {
    return '';
  }

  return segundos < 60 ? `${String(Math.ceil(segundos))} s` : `${String(Math.ceil(segundos / 60))} min`;
}

export function CargadorArchivos({
  nombre,
  etiqueta,
  ayuda,
  maximo,
  error,
}: {
  nombre: string;
  etiqueta: string;
  ayuda?: string;
  maximo: number;
  error?: string | undefined;
}): ReactNode {
  const id = useId();
  const [cargas, setCargas] = useState<Carga[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const selector = useRef<HTMLInputElement>(null);
  const centinela = useRef<HTMLInputElement>(null);
  const controladores = useRef(new Map<string, AbortController>());
  const pendientes = cargas.some(({ estado }) => estado === 'en-cola' || estado === 'subiendo' || estado === 'verificando');

  const actualizar = useCallback((clave: string, cambios: Partial<Carga>): void => {
    setCargas((actuales) => actuales.map((carga) => (carga.clave === clave ? { ...carga, ...cambios } : carga)));
  }, []);

  const iniciar = useCallback(
    (carga: Carga): void => {
      const controlador = new AbortController();
      const comienzo = performance.now();
      controladores.current.set(carga.clave, controlador);
      actualizar(carga.clave, { estado: 'subiendo', enviados: 0, mensaje: null });

      subirArchivo(
        carga.archivo,
        (enviados) => {
          const segundos = (performance.now() - comienzo) / 1000;
          actualizar(carga.clave, {
            enviados,
            velocidad: segundos > 0.3 ? enviados / segundos : 0,
            ...(enviados >= carga.archivo.size ? { estado: 'verificando' as const } : {}),
          });
        },
        controlador.signal,
      )
        .then((completa) => {
          actualizar(carga.clave, { estado: 'lista', subidaId: completa.id, enviados: carga.archivo.size });
        })
        .catch((causa: unknown) => {
          if (!controlador.signal.aborted) {
            actualizar(carga.clave, {
              estado: 'error',
              mensaje: causa instanceof Error ? causa.message : 'No se pudo subir el archivo.',
            });
          }
        })
        .finally(() => {
          controladores.current.delete(carga.clave);
        });
    },
    [actualizar],
  );

  useEffect(() => {
    const enCurso = cargas.filter(({ estado }) => estado === 'subiendo' || estado === 'verificando').length;
    const enCola = cargas.filter(({ estado }) => estado === 'en-cola');

    for (const carga of enCola.slice(0, Math.max(SIMULTANEOS - enCurso, 0))) {
      iniciar(carga);
    }
  }, [cargas, iniciar]);

  useEffect(() => {
    centinela.current?.setCustomValidity(pendientes ? 'Espere a que terminen de subir los archivos.' : '');
  }, [pendientes]);

  useEffect(() => {
    const activos = controladores.current;
    return () => {
      for (const controlador of activos.values()) {
        controlador.abort();
      }
    };
  }, []);

  const agregar = (lista: FileList | null): void => {
    if (lista === null) {
      return;
    }

    const disponibles = Math.max(maximo - cargas.filter(({ estado }) => estado !== 'error').length, 0);
    const nuevas = Array.from(lista)
      .slice(0, disponibles)
      .map((archivo): Carga => {
        const problema = validar(archivo);
        return {
          clave: `${archivo.name}-${String(archivo.size)}-${String(Math.random()).slice(2, 10)}`,
          archivo,
          estado: problema === null ? 'en-cola' : 'error',
          enviados: 0,
          velocidad: 0,
          subidaId: null,
          mensaje: problema,
        };
      });

    setCargas((actuales) => [...actuales, ...nuevas]);
  };

  const quitar = (clave: string): void => {
    controladores.current.get(clave)?.abort();
    setCargas((actuales) => actuales.filter((carga) => carga.clave !== clave));
  };

  const alSoltar = (evento: DragEvent<HTMLDivElement>): void => {
    evento.preventDefault();
    setArrastrando(false);
    agregar(evento.dataTransfer.files);
  };

  const listas = cargas.filter(({ estado }) => estado === 'lista').length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <span id={`${id}-etiqueta`} className="text-sm font-medium text-tinta">
          {etiqueta}
        </span>
        {cargas.length === 0 ? null : (
          <span className="text-xs text-apagado tabular-nums">
            {listas} de {maximo} listos
          </span>
        )}
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-labelledby={`${id}-etiqueta`}
        aria-describedby={`${id}-ayuda`}
        onClick={() => selector.current?.click()}
        onKeyDown={(evento) => {
          if (evento.key === 'Enter' || evento.key === ' ') {
            evento.preventDefault();
            selector.current?.click();
          }
        }}
        onDragOver={(evento) => {
          evento.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => {
          setArrastrando(false);
        }}
        onDrop={alSoltar}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-7 text-center transition-all focus:outline-2 focus:outline-offset-2 focus:outline-marino-claro',
          arrastrando ? 'scale-[1.01] border-marino bg-marino/5' : 'border-borde bg-fondo/60 hover:border-marino-claro hover:bg-marino/[0.03]',
        )}
      >
        <span className={cn('flex size-12 items-center justify-center rounded-full transition-colors', arrastrando ? 'bg-marino text-white' : 'bg-marino/8 text-marino')}>
          <CloudUpload aria-hidden="true" className="size-6" />
        </span>
        <span className="text-sm font-semibold text-tinta">
          {arrastrando ? 'Suelte los archivos para subirlos' : 'Arrastre archivos aquí o haga clic para elegirlos'}
        </span>
        <span id={`${id}-ayuda`} className="text-xs text-apagado">
          {ayuda ?? `PDF, Word, Excel, PowerPoint, CSV, TXT, imágenes o ZIP · hasta ${String(TAMANO_MAXIMO_SUBIDA_MB)} MB cada uno · máximo ${String(maximo)}`}
        </span>
      </div>

      <input
        ref={selector}
        type="file"
        multiple
        accept={ACEPTAR_SUBIDA}
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={(evento) => {
          agregar(evento.target.files);
          evento.target.value = '';
        }}
      />
      <input
        ref={centinela}
        tabIndex={-1}
        aria-hidden="true"
        defaultValue=""
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
      {cargas
        .filter(({ estado, subidaId }) => estado === 'lista' && subidaId !== null)
        .map(({ clave, subidaId }) => (
          <input key={clave} type="hidden" name={nombre} value={subidaId ?? ''} />
        ))}

      {cargas.length === 0 ? null : (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {cargas.map((carga) => {
            const porcentaje = carga.archivo.size === 0 ? 0 : Math.min(100, Math.round((carga.enviados / carga.archivo.size) * 100));
            const restante = carga.velocidad > 0 ? (carga.archivo.size - carga.enviados) / carga.velocidad : 0;

            return (
              <li
                key={carga.clave}
                className={cn(
                  'flex items-center gap-3 rounded-lg border bg-superficie px-3 py-2.5 transition-colors',
                  carga.estado === 'error' ? 'border-rojo/40 bg-rojo-suave/40' : carga.estado === 'lista' ? 'border-verde/30' : 'border-borde',
                )}
              >
                <IconoArchivo nombre={carga.archivo.name} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-tinta">{carga.archivo.name}</span>
                    <span className="shrink-0 text-xs text-apagado tabular-nums">{formatearTamano(carga.archivo.size)}</span>
                  </div>
                  {carga.estado === 'error' ? (
                    <span className="text-xs font-medium text-rojo">{carga.mensaje}</span>
                  ) : carga.estado === 'lista' ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-verde">
                      <CheckCircle2 aria-hidden="true" className="size-3.5" /> Listo para adjuntar
                    </span>
                  ) : (
                    <>
                      <span
                        className="h-1.5 overflow-hidden rounded-full bg-borde"
                        role="progressbar"
                        aria-valuenow={porcentaje}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Subiendo ${carga.archivo.name}`}
                      >
                        <span
                          className={cn('block h-full rounded-full bg-marino transition-[width] duration-200', carga.estado === 'verificando' && 'animate-pulse')}
                          style={{ width: `${String(porcentaje)}%` }}
                        />
                      </span>
                      <span className="text-xs text-apagado tabular-nums">
                        {carga.estado === 'en-cola'
                          ? 'En cola'
                          : carga.estado === 'verificando'
                            ? 'Verificando el archivo…'
                            : `${String(porcentaje)} % · ${formatearTamano(carga.velocidad)}/s${restante > 0 ? ` · quedan ${formatearSegundos(restante)}` : ''}`}
                      </span>
                    </>
                  )}
                </div>
                {carga.estado === 'subiendo' || carga.estado === 'verificando' ? (
                  <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin text-marino" />
                ) : null}
                {carga.estado === 'error' && validar(carga.archivo) === null ? (
                  <button
                    type="button"
                    onClick={() => {
                      actualizar(carga.clave, { estado: 'en-cola', mensaje: null, enviados: 0 });
                    }}
                    aria-label={`Reintentar ${carga.archivo.name}`}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-marino hover:bg-marino/8"
                  >
                    <RotateCw aria-hidden="true" className="size-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    quitar(carga.clave);
                  }}
                  aria-label={`Quitar ${carga.archivo.name}`}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-apagado hover:bg-fondo hover:text-rojo"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error === undefined ? null : <p className="text-sm font-medium text-rojo">{error}</p>}
    </div>
  );
}
