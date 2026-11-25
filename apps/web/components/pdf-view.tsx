'use client';

import { cn } from '@sige/ui/cn';
import { ChevronLeft, ChevronRight, LoaderCircle, MoveHorizontal, PanelLeft, ZoomIn, ZoomOut } from 'lucide-react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from 'react';

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

async function abrirDocumento(url: string): Promise<PDFDocumentProxy> {
  const pdfjs = await import('pdfjs-dist');
  await import('pdfjs-dist/build/pdf.worker.min.mjs');
  return pdfjs.getDocument({ url, rangeChunkSize: 1024 * 1024, disableAutoFetch: true, isEvalSupported: false }).promise;
}

function useVisible<T extends Element>(margen: string): [RefObject<T | null>, boolean] {
  const referencia = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const elemento = referencia.current;

    if (elemento === null) {
      return undefined;
    }

    const observador = new IntersectionObserver(
      ([entrada]) => {
        setVisible(entrada?.isIntersecting === true);
      },
      { rootMargin: margen },
    );
    observador.observe(elemento);
    return () => {
      observador.disconnect();
    };
  }, [margen]);

  return [referencia, visible];
}

function Lienzo({
  documento,
  numero,
  ancho,
  proporcion,
  margen,
  className,
}: {
  documento: PDFDocumentProxy;
  numero: number;
  ancho: number;
  proporcion: number;
  margen: string;
  className?: string;
}): ReactNode {
  const [contenedor, visible] = useVisible<HTMLDivElement>(margen);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [lista, setLista] = useState(false);

  useEffect(() => {
    if (!visible || ancho <= 0) {
      return undefined;
    }

    let tarea: RenderTask | null = null;
    let cancelado = false;

    void documento.getPage(numero).then((pagina) => {
      if (cancelado || lienzo.current === null) {
        return;
      }

      const base = pagina.getViewport({ scale: 1 });
      const escala = ancho / base.width;
      const densidad = Math.min(window.devicePixelRatio || 1, 2);
      const vista = pagina.getViewport({ scale: escala * densidad });
      const canvas = lienzo.current;
      canvas.width = Math.floor(vista.width);
      canvas.height = Math.floor(vista.height);
      const contexto = canvas.getContext('2d');

      if (contexto === null) {
        return;
      }

      tarea = pagina.render({ canvasContext: contexto, viewport: vista });
      tarea.promise
        .then(() => {
          if (!cancelado) {
            setLista(true);
          }
        })
        .catch(() => undefined);
    });

    return () => {
      cancelado = true;
      tarea?.cancel();
    };
  }, [visible, documento, numero, ancho]);

  return (
    <div
      ref={contenedor}
      className={cn('relative overflow-hidden bg-white', className)}
      style={{ width: ancho, height: Math.round(ancho * proporcion) }}
    >
      <canvas ref={lienzo} className={cn('h-full w-full transition-opacity duration-300', lista ? 'opacity-100' : 'opacity-0')} />
      {lista ? null : (
        <span className="absolute inset-0 flex items-center justify-center">
          <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-borde" />
        </span>
      )}
    </div>
  );
}

export function VistaPdf({ url, nombre }: { url: string; nombre: string }): ReactNode {
  const [documento, setDocumento] = useState<PDFDocumentProxy | null>(null);
  const [proporcion, setProporcion] = useState(1.414);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number | 'ancho'>('ancho');
  const [miniaturas, setMiniaturas] = useState(true);
  const [actual, setActual] = useState(1);
  const [anchoDisponible, setAnchoDisponible] = useState(0);
  const area = useRef<HTMLDivElement>(null);
  const paginas = useRef(new Map<number, HTMLDivElement>());

  useEffect(() => {
    let vigente = true;
    let abierto: PDFDocumentProxy | null = null;

    abrirDocumento(url)
      .then(async (cargado) => {
        abierto = cargado;
        const primera = await cargado.getPage(1);
        const vista = primera.getViewport({ scale: 1 });

        if (vigente) {
          setProporcion(vista.height / vista.width);
          setDocumento(cargado);
        }
      })
      .catch(() => {
        if (vigente) {
          setError('No se pudo abrir el documento.');
        }
      });

    return () => {
      vigente = false;
      void abierto?.destroy();
    };
  }, [url]);

  useEffect(() => {
    const elemento = area.current;

    if (elemento === null) {
      return undefined;
    }

    const observador = new ResizeObserver(([entrada]) => {
      setAnchoDisponible(Math.max((entrada?.contentRect.width ?? 0) - 48, 200));
    });
    observador.observe(elemento);
    return () => {
      observador.disconnect();
    };
  }, [documento]);

  useEffect(() => {
    const raiz = area.current;

    if (raiz === null || documento === null) {
      return undefined;
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        const visible = entradas.filter(({ isIntersecting }) => isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const numero = Number((visible?.target as HTMLElement | undefined)?.dataset.pagina);

        if (Number.isFinite(numero) && numero > 0) {
          setActual(numero);
        }
      },
      { root: raiz, threshold: [0.25, 0.5, 0.75] },
    );

    for (const elemento of paginas.current.values()) {
      observador.observe(elemento);
    }

    return () => {
      observador.disconnect();
    };
  }, [documento, zoom, anchoDisponible]);

  const irA = useCallback((numero: number): void => {
    paginas.current.get(numero)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const cambiarZoom = (paso: number): void => {
    const base = zoom === 'ancho' ? Math.min(anchoDisponible / 816, 3) : zoom;
    const indice = ZOOMS.findIndex((valor) => valor >= base - 0.01);
    const siguiente = ZOOMS[Math.min(Math.max((indice < 0 ? ZOOMS.length - 1 : indice) + paso, 0), ZOOMS.length - 1)] ?? 1;
    setZoom(siguiente);
  };

  if (error !== null) {
    return <p className="m-auto text-sm text-white/80">{error}</p>;
  }

  if (documento === null) {
    return (
      <span className="m-auto flex items-center gap-2 text-sm text-white/80">
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> Abriendo {nombre}…
      </span>
    );
  }

  const total = documento.numPages;
  const anchoPagina = zoom === 'ancho' ? anchoDisponible : Math.round(816 * zoom);
  const porcentaje = Math.round((anchoPagina / 816) * 100);
  const numeros = Array.from({ length: total }, (_, indice) => indice + 1);
  const boton = 'inline-flex size-9 items-center justify-center rounded-md text-white/85 hover:bg-white/10 disabled:opacity-30';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-center gap-1 border-b border-white/10 bg-marino-profundo/80 px-3 py-1.5 text-sm text-white">
        <button
          type="button"
          className={cn(boton, 'hidden md:inline-flex', miniaturas && 'bg-white/10')}
          aria-pressed={miniaturas}
          aria-label="Miniaturas"
          onClick={() => {
            setMiniaturas(!miniaturas);
          }}
        >
          <PanelLeft aria-hidden="true" className="size-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-white/15" />
        <button type="button" className={boton} aria-label="Página anterior" disabled={actual <= 1} onClick={() => { irA(actual - 1); }}>
          <ChevronLeft aria-hidden="true" className="size-4" />
        </button>
        <label className="flex items-center gap-1.5 tabular-nums">
          <span className="sr-only">Página</span>
          <input
            key={actual}
            type="number"
            min={1}
            max={total}
            defaultValue={actual}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') {
                const numero = Number(evento.currentTarget.value);

                if (numero >= 1 && numero <= total) {
                  irA(numero);
                }
              }
            }}
            className="h-8 w-14 rounded-md border border-white/20 bg-white/10 text-center text-white focus:border-dorado focus:outline-none"
          />
          <span className="text-white/70">de {total}</span>
        </label>
        <button type="button" className={boton} aria-label="Página siguiente" disabled={actual >= total} onClick={() => { irA(actual + 1); }}>
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-white/15" />
        <button type="button" className={boton} aria-label="Alejar" onClick={() => { cambiarZoom(-1); }}>
          <ZoomOut aria-hidden="true" className="size-4" />
        </button>
        <span className="w-12 text-center tabular-nums text-white/85">{porcentaje} %</span>
        <button type="button" className={boton} aria-label="Acercar" onClick={() => { cambiarZoom(1); }}>
          <ZoomIn aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          className={cn(boton, 'w-auto gap-1.5 px-2.5 text-xs font-semibold', zoom === 'ancho' && 'bg-white/10')}
          aria-pressed={zoom === 'ancho'}
          onClick={() => {
            setZoom('ancho');
          }}
        >
          <MoveHorizontal aria-hidden="true" className="size-4" /> Ajustar
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {miniaturas ? (
          <nav aria-label="Páginas" className="hidden w-40 shrink-0 overflow-y-auto border-r border-white/10 bg-marino-profundo/60 p-3 md:block">
            <ol className="flex flex-col items-center gap-3">
              {numeros.map((numero) => (
                <li key={numero}>
                  <button
                    type="button"
                    onClick={() => { irA(numero); }}
                    aria-current={numero === actual ? 'page' : undefined}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-md p-1 transition-colors',
                      numero === actual ? 'bg-dorado/20 ring-2 ring-dorado' : 'hover:bg-white/10',
                    )}
                  >
                    <Lienzo documento={documento} numero={numero} ancho={104} proporcion={proporcion} margen="300px" className="shadow" />
                    <span className="text-xs text-white/75 tabular-nums">{numero}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <div ref={area} className="min-w-0 flex-1 overflow-auto bg-[#3b4252] px-6 py-6">
          <div className="mx-auto flex w-max flex-col items-center gap-5">
            {numeros.map((numero) => (
              <div
                key={numero}
                data-pagina={numero}
                ref={(elemento) => {
                  if (elemento === null) {
                    paginas.current.delete(numero);
                  } else {
                    paginas.current.set(numero, elemento);
                  }
                }}
                className="scroll-mt-4"
              >
                <Lienzo
                  documento={documento}
                  numero={numero}
                  ancho={anchoPagina}
                  proporcion={proporcion}
                  margen="900px"
                  className="rounded-sm shadow-[0_8px_28px_rgb(0_0_0/0.35)]"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
