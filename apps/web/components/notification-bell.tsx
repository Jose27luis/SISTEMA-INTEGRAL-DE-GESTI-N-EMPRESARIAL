'use client';

import type { ResumenNotificaciones } from '@sige/types';
import { cn } from '@sige/ui/cn';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
  leerResumenNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
} from '@/app/(panel)/notificaciones/actions';
import { formatearFechaHora } from '@/lib/format';

interface PropiedadesCampana {
  inicial: ResumenNotificaciones | null;
  alinear?: 'izquierda' | 'derecha';
}

export function CampanaNotificaciones({ inicial, alinear = 'izquierda' }: PropiedadesCampana): ReactNode {
  const [resumen, setResumen] = useState<ResumenNotificaciones>(inicial ?? { noLeidas: 0, recientes: [] });
  const [abierta, setAbierta] = useState(false);
  const [, iniciarTransicion] = useTransition();
  const contenedor = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const actualizar = useCallback(() => {
    iniciarTransicion(async () => {
      const nuevo = await leerResumenNotificaciones();

      if (nuevo !== null) {
        setResumen(nuevo);
      }
    });
  }, []);

  useEffect(() => {
    const fuente = new EventSource('/eventos');
    fuente.addEventListener('notificacion', actualizar);

    return () => {
      fuente.close();
    };
  }, [actualizar]);

  useEffect(() => {
    if (!abierta) {
      return undefined;
    }

    const cerrarFuera = (evento: PointerEvent): void => {
      if (evento.target instanceof Node && contenedor.current?.contains(evento.target) !== true) {
        setAbierta(false);
      }
    };
    const cerrarConEscape = (evento: KeyboardEvent): void => {
      if (evento.key === 'Escape') {
        setAbierta(false);
      }
    };

    document.addEventListener('pointerdown', cerrarFuera);
    document.addEventListener('keydown', cerrarConEscape);

    return () => {
      document.removeEventListener('pointerdown', cerrarFuera);
      document.removeEventListener('keydown', cerrarConEscape);
    };
  }, [abierta]);

  const abrir = (id: string, enlace: string): void => {
    setAbierta(false);
    iniciarTransicion(async () => {
      await marcarNotificacionLeida(id);
      actualizar();
    });
    router.push(enlace);
  };

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        onClick={() => {
          setAbierta((actual) => !actual);
        }}
        aria-expanded={abierta}
        aria-haspopup="true"
        aria-label={
          resumen.noLeidas === 0 ? 'Notificaciones' : `Notificaciones, ${String(resumen.noLeidas)} sin leer`
        }
        className="relative inline-flex size-11 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white"
      >
        <Bell aria-hidden="true" className="size-5" />
        {resumen.noLeidas === 0 ? null : (
          <span className="absolute top-1.5 right-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-dorado px-1 text-[0.65rem] font-bold text-marino">
            {resumen.noLeidas > 99 ? '99+' : resumen.noLeidas}
          </span>
        )}
      </button>
      {abierta ? (
        <div
          className={cn(
            'absolute top-12 z-30 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-borde bg-superficie text-tinta shadow-xl',
            alinear === 'izquierda' ? 'left-0' : 'right-0',
          )}
        >
          <div className="flex items-center justify-between border-b border-borde px-4 py-3">
            <p className="text-sm font-semibold text-marino">Notificaciones</p>
            {resumen.noLeidas === 0 ? null : (
              <button
                type="button"
                onClick={() => {
                  iniciarTransicion(async () => {
                    await marcarTodasLeidas();
                    actualizar();
                  });
                }}
                className="text-xs font-semibold text-marino-claro hover:underline"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>
          {resumen.recientes.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-apagado">No tiene notificaciones.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-borde overflow-y-auto">
              {resumen.recientes.map((notificacion) => (
                <li key={notificacion.id}>
                  <button
                    type="button"
                    onClick={() => {
                      abrir(notificacion.id, notificacion.enlace);
                    }}
                    className={cn(
                      'flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-fondo',
                      !notificacion.leida && 'bg-dorado-suave/60',
                    )}
                  >
                    <span className="text-sm font-semibold text-marino">{notificacion.titulo}</span>
                    <span className="line-clamp-2 text-xs text-apagado">{notificacion.mensaje}</span>
                    <span className="text-[0.7rem] text-apagado">{formatearFechaHora(notificacion.creadoEn)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/notificaciones"
            onClick={() => {
              setAbierta(false);
            }}
            className="block border-t border-borde px-4 py-3 text-center text-sm font-semibold text-marino-claro hover:bg-fondo"
          >
            Ver todas
          </Link>
        </div>
      ) : null}
    </div>
  );
}
