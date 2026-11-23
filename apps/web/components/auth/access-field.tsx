'use client';

import { cn } from '@sige/ui/cn';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { Aparecer } from './appear';

interface PropiedadesCampoAcceso extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  etiqueta: string;
  icono: LucideIcon;
  ayuda?: string | undefined;
  error?: string | undefined;
  accesorio?: ReactNode;
}

export function CampoAcceso({
  id,
  etiqueta,
  icono: Icono,
  ayuda,
  error,
  accesorio,
  className,
  ...resto
}: PropiedadesCampoAcceso): ReactNode {
  const descripcion = [ayuda === undefined ? null : `${id}-ayuda`, error === undefined ? null : `${id}-error`]
    .filter((valor): valor is string => valor !== null)
    .join(' ');

  return (
    <Aparecer className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-tinta">
        {etiqueta}
      </label>
      <div className="group relative">
        <Icono
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-apagado transition-colors duration-300 group-focus-within:text-marino',
            error !== undefined && 'text-rojo',
          )}
        />
        <input
          id={id}
          aria-invalid={error !== undefined}
          aria-describedby={descripcion === '' ? undefined : descripcion}
          className={cn(
            'h-13 w-full rounded-xl border border-borde bg-fondo/60 pr-4 pl-12 text-base text-tinta transition-all duration-300 hover:border-marino-claro/50 focus:border-marino focus:bg-superficie focus:shadow-[0_0_0_4px_rgba(1,41,93,0.12)] focus:outline-none',
            accesorio !== undefined && 'pr-12',
            error !== undefined && 'border-rojo focus:shadow-[0_0_0_4px_rgba(179,38,30,0.12)]',
            className,
          )}
          {...resto}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-3 -bottom-px h-0.5 origin-center scale-x-0 rounded-full bg-gradient-to-r from-marino via-dorado to-verde transition-transform duration-500 group-focus-within:scale-x-100"
        />
        {accesorio}
      </div>
      {ayuda === undefined ? null : (
        <p id={`${id}-ayuda`} className="text-sm text-apagado">
          {ayuda}
        </p>
      )}
      <AnimatePresence initial={false}>
        {error === undefined ? null : (
          <motion.p
            id={`${id}-error`}
            key={error}
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="text-sm font-medium text-rojo"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </Aparecer>
  );
}
