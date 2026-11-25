'use client';

import { type ReactNode, type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../cn';

export interface PosicionPanel {
  izquierda: number;
  arriba: number | null;
  abajo: number | null;
  ancho: number;
  altoMaximo: number;
}

export function usePanelFlotante(
  ancla: RefObject<HTMLElement | null>,
  abierto: boolean,
  alCerrar: () => void,
  { anchoMinimo, altoDeseado }: { anchoMinimo: number; altoDeseado: number },
): { posicion: PosicionPanel | null; panel: RefObject<HTMLDivElement | null> } {
  const panel = useRef<HTMLDivElement>(null);
  const [posicion, setPosicion] = useState<PosicionPanel | null>(null);

  const calcular = useCallback((): void => {
    const rect = ancla.current?.getBoundingClientRect();

    if (rect === undefined) {
      return;
    }

    const margen = 8;
    const ancho = Math.min(Math.max(rect.width, anchoMinimo), window.innerWidth - margen * 2);
    const izquierda = Math.min(Math.max(rect.left, margen), window.innerWidth - ancho - margen);
    const espacioAbajo = window.innerHeight - rect.bottom - margen;
    const espacioArriba = rect.top - margen;
    const haciaArriba = espacioAbajo < Math.min(altoDeseado, 260) && espacioArriba > espacioAbajo;

    setPosicion({
      izquierda,
      ancho,
      arriba: haciaArriba ? null : rect.bottom + 4,
      abajo: haciaArriba ? window.innerHeight - rect.top + 4 : null,
      altoMaximo: Math.max(180, haciaArriba ? espacioArriba : espacioAbajo),
    });
  }, [ancla, anchoMinimo, altoDeseado]);

  useLayoutEffect(() => {
    if (!abierto) {
      setPosicion(null);
      return;
    }

    const rect = ancla.current?.getBoundingClientRect();

    if (rect !== undefined) {
      const faltante = altoDeseado + 12 - (window.innerHeight - rect.bottom);
      const disponible = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      const espacioArriba = rect.top - 8;

      if (faltante > 0 && disponible > 0) {
        window.scrollBy({ top: Math.min(faltante, disponible, Math.max(espacioArriba - 8, 0)), behavior: 'instant' });
      }
    }

    calcular();
  }, [abierto, ancla, altoDeseado, calcular]);

  useEffect(() => {
    if (!abierto) {
      return undefined;
    }

    const alPresionar = (evento: PointerEvent): void => {
      const destino = evento.target as Node;

      if (!ancla.current?.contains(destino) && !panel.current?.contains(destino)) {
        alCerrar();
      }
    };

    document.addEventListener('pointerdown', alPresionar);
    window.addEventListener('resize', calcular);
    window.addEventListener('scroll', calcular, true);

    return () => {
      document.removeEventListener('pointerdown', alPresionar);
      window.removeEventListener('resize', calcular);
      window.removeEventListener('scroll', calcular, true);
    };
  }, [abierto, ancla, alCerrar, calcular]);

  return { posicion, panel };
}

export function PanelFlotante({
  posicion,
  panel,
  etiqueta,
  className,
  children,
}: {
  posicion: PosicionPanel | null;
  panel: RefObject<HTMLDivElement | null>;
  etiqueta: string;
  className?: string;
  children: ReactNode;
}): ReactNode {
  if (posicion === null) {
    return null;
  }

  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-label={etiqueta}
      className={cn(
        'fixed z-[60] overflow-auto overscroll-contain rounded-lg border border-borde bg-superficie p-3 shadow-[0_12px_32px_rgb(1_41_93/0.18)]',
        className,
      )}
      style={{
        left: posicion.izquierda,
        width: posicion.ancho,
        maxHeight: posicion.altoMaximo,
        ...(posicion.arriba === null ? {} : { top: posicion.arriba }),
        ...(posicion.abajo === null ? {} : { bottom: posicion.abajo }),
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export function asignarValorEntrada(elemento: HTMLInputElement, valor: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  descriptor?.set?.call(elemento, valor);
  elemento.dispatchEvent(new Event('input', { bubbles: true }));
}

export function IconoCalendario(): ReactNode {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 shrink-0 text-apagado">
      <rect x="3" y="4.5" width="14" height="12.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 8.5h14M7 2.8v3.4M13 2.8v3.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconoReloj(): ReactNode {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 shrink-0 text-apagado">
      <circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 6v4.2l2.8 1.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Flecha({ direccion }: { direccion: 'izquierda' | 'derecha' }): ReactNode {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4">
      <path
        d={direccion === 'izquierda' ? 'M12.5 5 7.5 10l5 5' : 'M7.5 5l5 5-5 5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
