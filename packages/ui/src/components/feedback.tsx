import type { ReactNode } from 'react';
import { cn } from '../cn';

export type TonoAviso = 'error' | 'exito' | 'info' | 'aviso';

const CLASES_ALERTA: Record<TonoAviso, string> = {
  error: 'border-rojo/30 bg-rojo-suave text-rojo',
  exito: 'border-verde/30 bg-verde-suave text-verde',
  info: 'border-marino-claro/20 bg-fondo text-marino',
  aviso: 'border-dorado/40 bg-dorado-suave text-tinta',
};

export interface PropiedadesAlerta {
  tono: TonoAviso;
  titulo?: string | undefined;
  children?: ReactNode;
  className?: string | undefined;
}

export function Alerta({ tono, titulo, children, className }: PropiedadesAlerta): ReactNode {
  return (
    <div
      role={tono === 'error' ? 'alert' : 'status'}
      className={cn('rounded-md border px-4 py-3 text-sm', CLASES_ALERTA[tono], className)}
    >
      {titulo === undefined ? null : <p className="font-semibold">{titulo}</p>}
      {children === undefined ? null : <div className={cn(titulo !== undefined && 'mt-1')}>{children}</div>}
    </div>
  );
}

export type TonoInsignia = 'neutro' | 'exito' | 'aviso' | 'peligro' | 'info';

const CLASES_INSIGNIA: Record<TonoInsignia, string> = {
  neutro: 'bg-fondo text-apagado border-borde',
  exito: 'bg-verde-suave text-verde border-verde/30',
  aviso: 'bg-dorado-suave text-tinta border-dorado/40',
  peligro: 'bg-rojo-suave text-rojo border-rojo/30',
  info: 'bg-marino/5 text-marino border-marino/20',
};

export interface PropiedadesInsignia {
  tono?: TonoInsignia;
  children: ReactNode;
}

export function Insignia({ tono = 'neutro', children }: PropiedadesInsignia): ReactNode {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        CLASES_INSIGNIA[tono],
      )}
    >
      {children}
    </span>
  );
}

export interface PropiedadesTarjeta {
  titulo?: string | undefined;
  descripcion?: string | undefined;
  acciones?: ReactNode;
  children: ReactNode;
  className?: string | undefined;
}

export function Tarjeta({ titulo, descripcion, acciones, children, className }: PropiedadesTarjeta): ReactNode {
  return (
    <section className={cn('rounded-lg border border-borde bg-superficie p-4 sm:p-6', className)}>
      {titulo === undefined && acciones === undefined ? null : (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            {titulo === undefined ? null : <h2 className="text-lg font-semibold text-marino">{titulo}</h2>}
            {descripcion === undefined ? null : <p className="text-sm text-apagado">{descripcion}</p>}
          </div>
          {acciones}
        </header>
      )}
      {children}
    </section>
  );
}
