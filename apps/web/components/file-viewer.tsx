'use client';

import { esquemaHojasArchivo, esquemaInfoArchivo, type HojasArchivo, type InfoArchivo } from '@sige/types';
import { cn } from '@sige/ui/cn';
import { Download, Eye, ExternalLink, FileWarning, LoaderCircle, Table2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatearFechaHora, formatearTamano } from '@/lib/format';
import { estiloArchivo, IconoArchivo } from './file-icon';
import { VistaPdf } from './pdf-view';

const SEGUNDOS_ESPERA = 3;
const MAXIMO_BYTES_TEXTO = 400 * 1024;

function letraColumna(indice: number): string {
  let resultado = '';
  let numero = indice + 1;

  while (numero > 0) {
    const resto = (numero - 1) % 26;
    resultado = String.fromCharCode(65 + resto) + resultado;
    numero = Math.floor((numero - 1) / 26);
  }

  return resultado;
}

function VistaTabla({ id }: { id: string }): ReactNode {
  const [hojas, setHojas] = useState<HojasArchivo['hojas'] | null>(null);
  const [error, setError] = useState(false);
  const [activa, setActiva] = useState(0);

  useEffect(() => {
    let vigente = true;

    fetch(`/archivos/${id}/hojas`)
      .then(async (respuesta) => {
        const datos = esquemaHojasArchivo.safeParse(respuesta.ok ? await respuesta.json() : null);

        if (vigente) {
          if (datos.success) {
            setHojas(datos.data.hojas);
          } else {
            setError(true);
          }
        }
      })
      .catch(() => {
        if (vigente) {
          setError(true);
        }
      });

    return () => {
      vigente = false;
    };
  }, [id]);

  if (error) {
    return <p className="m-auto text-sm text-white/80">No se pudo leer la hoja de cálculo.</p>;
  }

  if (hojas === null) {
    return (
      <span className="m-auto flex items-center gap-2 text-sm text-white/80">
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> Leyendo hojas…
      </span>
    );
  }

  const hoja = hojas[activa];

  if (hoja === undefined) {
    return <p className="m-auto text-sm text-white/80">El archivo no tiene hojas.</p>;
  }

  const columnas = hoja.filas.reduce((maximo, fila) => Math.max(maximo, fila.length), 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-superficie">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-20 h-8 min-w-12 border-r border-b border-borde bg-[#eef1f5]" />
              {Array.from({ length: columnas }, (_, indice) => (
                <th
                  key={indice}
                  scope="col"
                  className="sticky top-0 z-10 h-8 min-w-28 border-r border-b border-borde bg-[#eef1f5] px-2 text-xs font-semibold text-apagado"
                >
                  {letraColumna(indice)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hoja.filas.map((fila, numero) => (
              <tr key={numero} className="hover:bg-marino/[0.03]">
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-r border-b border-borde bg-[#eef1f5] px-2 text-right text-xs font-semibold text-apagado tabular-nums"
                >
                  {numero + 1}
                </th>
                {Array.from({ length: columnas }, (_, indice) => {
                  const valor = fila[indice] ?? '';

                  return (
                    <td
                      key={indice}
                      title={valor.length > 40 ? valor : undefined}
                      className={cn(
                        'h-8 max-w-72 truncate border-r border-b border-borde px-2 text-tinta',
                        /^-?[\d.,]+$/u.test(valor) && 'text-right tabular-nums',
                      )}
                    >
                      {valor}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto border-t border-borde bg-[#eef1f5] px-2 py-1">
        {hojas.map((opcion, indice) => (
          <button
            key={opcion.nombre}
            type="button"
            aria-pressed={indice === activa}
            onClick={() => {
              setActiva(indice);
            }}
            className={cn(
              'shrink-0 rounded-t-md border-b-2 px-3 py-1.5 text-sm font-semibold transition-colors',
              indice === activa ? 'border-verde bg-superficie text-verde' : 'border-transparent text-apagado hover:bg-superficie/60',
            )}
          >
            {opcion.nombre}
          </button>
        ))}
        {hoja.recortada ? (
          <span className="ml-auto shrink-0 pl-4 text-xs text-apagado">
            Se muestran {Math.min(hoja.totalFilas, hoja.filas.length)} de {hoja.totalFilas} filas y {columnas} de {hoja.totalColumnas} columnas.
            Descargue el archivo para verlo completo.
          </span>
        ) : null}
      </div>
    </div>
  );
}

function VistaImagen({ url, nombre }: { url: string; nombre: string }): ReactNode {
  const [escala, setEscala] = useState(1);
  const boton = 'inline-flex size-9 items-center justify-center rounded-md text-white/85 hover:bg-white/10';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-center gap-1 border-b border-white/10 bg-marino-profundo/80 px-3 py-1.5 text-sm text-white">
        <button type="button" className={boton} aria-label="Alejar" onClick={() => { setEscala(Math.max(0.25, escala - 0.25)); }}>
          <ZoomOut aria-hidden="true" className="size-4" />
        </button>
        <span className="w-12 text-center tabular-nums">{Math.round(escala * 100)} %</span>
        <button type="button" className={boton} aria-label="Acercar" onClick={() => { setEscala(Math.min(4, escala + 0.25)); }}>
          <ZoomIn aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 overflow-auto bg-[#3b4252] p-6">
        <img
          src={url}
          alt={nombre}
          className="m-auto max-w-none rounded-sm shadow-[0_8px_28px_rgb(0_0_0/0.35)] transition-transform"
          style={{ width: `${String(escala * 100)}%`, maxWidth: escala === 1 ? '100%' : 'none' }}
        />
      </div>
    </div>
  );
}

function VistaTexto({ url }: { url: string }): ReactNode {
  const [texto, setTexto] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;

    fetch(url, { headers: { range: `bytes=0-${String(MAXIMO_BYTES_TEXTO - 1)}` } })
      .then((respuesta) => respuesta.text())
      .then((contenido) => {
        if (vigente) {
          setTexto(contenido);
        }
      })
      .catch(() => {
        if (vigente) {
          setTexto('No se pudo leer el archivo.');
        }
      });

    return () => {
      vigente = false;
    };
  }, [url]);

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-superficie p-6">
      {texto === null ? (
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-apagado" />
      ) : (
        <pre className="font-mono text-sm whitespace-pre-wrap text-tinta">{texto}</pre>
      )}
    </div>
  );
}

function Mensaje({ icono, titulo, detalle }: { icono: ReactNode; titulo: string; detalle: string }): ReactNode {
  return (
    <div className="m-auto flex max-w-md flex-col items-center gap-3 px-6 text-center text-white">
      {icono}
      <p className="text-lg font-semibold">{titulo}</p>
      <p className="text-sm text-white/75">{detalle}</p>
    </div>
  );
}

export function VisorArchivo({ id, nombre, alCerrar }: { id: string; nombre: string; alCerrar: () => void }): ReactNode {
  const [info, setInfo] = useState<InfoArchivo | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [modo, setModo] = useState<'tabla' | 'pdf'>('tabla');
  const cerrar = useRef<HTMLButtonElement>(null);
  const alCerrarActual = useRef(alCerrar);

  useEffect(() => {
    alCerrarActual.current = alCerrar;
  }, [alCerrar]);

  useEffect(() => {
    let vigente = true;
    let espera: ReturnType<typeof setTimeout> | undefined;

    const consultar = async (): Promise<void> => {
      try {
        const respuesta = await fetch(`/archivos/${id}/info`);

        if (!respuesta.ok) {
          throw new Error(respuesta.status === 403 ? 'No tiene acceso a este archivo.' : 'El archivo no está disponible.');
        }

        const datos = esquemaInfoArchivo.parse(await respuesta.json());

        if (!vigente) {
          return;
        }

        setInfo(datos);

        if (datos.vistaPdf === 'PENDIENTE' || datos.vistaPdf === 'PROCESANDO') {
          espera = setTimeout(() => void consultar(), SEGUNDOS_ESPERA * 1000);
        }
      } catch (error) {
        if (vigente) {
          setFallo(error instanceof Error ? error.message : 'El archivo no está disponible.');
        }
      }
    };

    void consultar();
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [id]);

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const desborde = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cerrar.current?.focus();

    const tecla = (evento: KeyboardEvent): void => {
      if (evento.key === 'Escape') {
        alCerrarActual.current();
      }
    };

    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = desborde;
      anterior?.focus();
    };
  }, []);

  const estilo = estiloArchivo(nombre);
  const preparando = info !== null && (info.vistaPdf === 'PENDIENTE' || info.vistaPdf === 'PROCESANDO');
  const pdfListo = info !== null && info.vistaPdf === 'LISTA';
  let contenido: ReactNode;

  if (fallo !== null) {
    contenido = <Mensaje icono={<FileWarning aria-hidden="true" className="size-10 text-dorado" />} titulo="No se puede mostrar" detalle={fallo} />;
  } else if (info === null) {
    contenido = <LoaderCircle aria-hidden="true" className="m-auto size-7 animate-spin text-white/80" />;
  } else if (info.tabla && modo === 'tabla') {
    contenido = <VistaTabla id={id} />;
  } else if (info.tipo === 'imagen') {
    contenido = <VistaImagen url={`/archivos/${id}`} nombre={info.nombre} />;
  } else if (pdfListo) {
    contenido = <VistaPdf url={`/archivos/${id}/vista`} nombre={info.nombre} />;
  } else if (preparando) {
    contenido = (
      <Mensaje
        icono={<LoaderCircle aria-hidden="true" className="size-10 animate-spin text-dorado" />}
        titulo="Preparando la vista previa"
        detalle={`Estamos convirtiendo el ${estilo.etiqueta.toLowerCase() === 'archivo' ? 'archivo' : `archivo de ${estilo.etiqueta}`} para mostrarlo aquí. Tarda unos segundos; mientras tanto puede descargarlo.`}
      />
    );
  } else if (info.tipo === 'texto') {
    contenido = <VistaTexto url={`/archivos/${id}`} />;
  } else {
    contenido = (
      <Mensaje
        icono={<IconoArchivo nombre={info.nombre} tamano="lg" />}
        titulo={info.vistaPdf === 'ERROR' ? 'No se pudo generar la vista previa' : 'Este archivo no tiene vista previa'}
        detalle="Descárguelo para abrirlo en su equipo."
      />
    );
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Vista de ${nombre}`}
      className="fixed inset-0 z-[70] flex flex-col bg-marino-profundo/95 backdrop-blur-sm"
    >
      <header className="flex items-center gap-3 border-b border-white/10 px-3 py-2.5 text-white sm:px-5">
        <IconoArchivo nombre={nombre} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold sm:text-base">{nombre}</p>
          {info === null ? null : (
            <p className="truncate text-xs text-white/65">
              {estilo.etiqueta} · {formatearTamano(info.tamanoBytes)} · {info.subidoPor} · {formatearFechaHora(info.subidoEn)}
            </p>
          )}
        </div>
        {info !== null && info.tabla && pdfListo ? (
          <div role="group" aria-label="Modo de vista" className="hidden rounded-lg bg-white/10 p-1 sm:inline-flex">
            {(
              [
                { clave: 'tabla', texto: 'Tabla', icono: Table2 },
                { clave: 'pdf', texto: 'Impresión', icono: Eye },
              ] as const
            ).map(({ clave, texto, icono: Icono }) => (
              <button
                key={clave}
                type="button"
                aria-pressed={modo === clave}
                onClick={() => {
                  setModo(clave);
                }}
                className={cn(
                  'inline-flex min-h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors',
                  modo === clave ? 'bg-white text-marino' : 'text-white/80 hover:text-white',
                )}
              >
                <Icono aria-hidden="true" className="size-3.5" />
                {texto}
              </button>
            ))}
          </div>
        ) : null}
        {info !== null && (info.tipo === 'pdf' || info.tipo === 'imagen') ? (
          <a
            href={`/archivos/${id}`}
            target="_blank"
            rel="noopener"
            className="hidden min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-white/85 hover:bg-white/10 sm:inline-flex"
          >
            <ExternalLink aria-hidden="true" className="size-4" /> Pestaña nueva
          </a>
        ) : null}
        <a
          href={`/archivos/${id}?descarga=1`}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-dorado px-3 text-sm font-semibold text-marino hover:bg-dorado/90"
        >
          <Download aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">Descargar</span>
        </a>
        <button
          ref={cerrar}
          type="button"
          onClick={alCerrar}
          aria-label="Cerrar"
          className="inline-flex size-9 items-center justify-center rounded-md text-white/85 hover:bg-white/10"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{contenido}</div>
    </div>,
    document.body,
  );
}

export function ArchivoAdjunto({
  id,
  nombre,
  tamanoBytes,
  className,
}: {
  id: string;
  nombre: string;
  tamanoBytes: number;
  className?: string;
}): ReactNode {
  const [abierto, setAbierto] = useState(false);
  const estilo = estiloArchivo(nombre);

  return (
    <>
      <div
        className={cn(
          'group flex items-center gap-3 rounded-lg border border-borde bg-superficie px-3 py-2 transition-all hover:border-marino-claro hover:shadow-[0_4px_14px_rgb(1_41_93/0.08)]',
          className,
        )}
      >
        <button
          type="button"
          onClick={() => {
            setAbierto(true);
          }}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <IconoArchivo nombre={nombre} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-tinta group-hover:text-marino">{nombre}</span>
            <span className="text-xs text-apagado">
              {estilo.etiqueta} · {formatearTamano(tamanoBytes)}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(true);
          }}
          aria-label={`Ver ${nombre}`}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-marino-claro hover:bg-marino/5"
        >
          <Eye aria-hidden="true" className="size-4" />
        </button>
        <a
          href={`/archivos/${id}?descarga=1`}
          aria-label={`Descargar ${nombre}`}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-marino-claro hover:bg-marino/5"
        >
          <Download aria-hidden="true" className="size-4" />
        </a>
      </div>
      {abierto ? (
        <VisorArchivo
          id={id}
          nombre={nombre}
          alCerrar={() => {
            setAbierto(false);
          }}
        />
      ) : null}
    </>
  );
}
