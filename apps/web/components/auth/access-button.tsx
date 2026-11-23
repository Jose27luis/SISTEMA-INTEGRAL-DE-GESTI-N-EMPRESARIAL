'use client';

import { ArrowRight, LoaderCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Aparecer } from './appear';

interface PropiedadesBotonAcceso {
  children: ReactNode;
  textoPendiente: string;
}

export function BotonAcceso({ children, textoPendiente }: PropiedadesBotonAcceso): ReactNode {
  const { pending } = useFormStatus();

  return (
    <Aparecer>
      <motion.button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        {...(pending
          ? {}
          : { whileHover: { y: -2, boxShadow: '0 18px 36px -14px rgba(1,41,93,0.65)' }, whileTap: { scale: 0.97 } })}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        className="group relative flex h-13 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-marino text-base font-semibold text-white shadow-[0_10px_24px_-12px_rgba(1,41,93,0.6)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-dorado disabled:cursor-wait disabled:opacity-80"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-[300%]"
        />
        <AnimatePresence mode="wait" initial={false}>
          {pending ? (
            <motion.span
              key="pendiente"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-2"
            >
              <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
              {textoPendiente}
            </motion.span>
          ) : (
            <motion.span
              key="listo"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-2"
            >
              {children}
              <ArrowRight
                aria-hidden="true"
                className="size-5 transition-transform duration-300 group-hover:translate-x-1"
              />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </Aparecer>
  );
}
