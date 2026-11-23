'use client';

import { CircleAlert, CircleCheck } from 'lucide-react';
import { AnimatePresence, motion, useAnimate } from 'motion/react';
import { type ReactNode, useEffect } from 'react';
import type { EstadoFormulario } from '@/lib/form-state';

interface PropiedadesMensajeAnimado {
  estado: EstadoFormulario;
}

export function MensajeAnimado({ estado }: PropiedadesMensajeAnimado): ReactNode {
  const [ambito, animar] = useAnimate<HTMLDivElement>();

  useEffect(() => {
    if (estado.mensaje !== null && !estado.exito) {
      void animar(ambito.current, { x: [0, -10, 10, -7, 7, -3, 0] }, { duration: 0.5 });
    }
  }, [estado, animar, ambito]);

  return (
    <AnimatePresence initial={false}>
      {estado.mensaje === null ? null : (
        <motion.div
          key="mensaje"
          initial={{ opacity: 0, height: 0, scale: 0.96 }}
          animate={{ opacity: 1, height: 'auto', scale: 1 }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            ref={ambito}
            role={estado.exito ? 'status' : 'alert'}
            className={
              estado.exito
                ? 'flex items-start gap-3 rounded-xl border border-verde/30 bg-verde-suave px-4 py-3 text-sm font-medium text-verde-oscuro'
                : 'flex items-start gap-3 rounded-xl border border-rojo/25 bg-rojo-suave px-4 py-3 text-sm font-medium text-rojo'
            }
          >
            {estado.exito ? (
              <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            ) : (
              <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            )}
            {estado.mensaje}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
