'use client';

import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useState } from 'react';
import { CampoAcceso } from './access-field';

interface PropiedadesCampoContrasenaAcceso {
  id: string;
  name: string;
  etiqueta: string;
  autoComplete: 'current-password' | 'new-password';
  error?: string | undefined;
}

export function CampoContrasenaAcceso({
  id,
  name,
  etiqueta,
  autoComplete,
  error,
}: PropiedadesCampoContrasenaAcceso): ReactNode {
  const [visible, setVisible] = useState(false);

  return (
    <CampoAcceso
      id={id}
      name={name}
      etiqueta={etiqueta}
      icono={LockKeyhole}
      type={visible ? 'text' : 'password'}
      autoComplete={autoComplete}
      required
      error={error}
      accesorio={
        <button
          type="button"
          onClick={() => {
            setVisible((actual) => !actual);
          }}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-apagado transition-colors hover:text-marino focus-visible:outline-2 focus-visible:outline-marino-claro"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={visible ? 'ocultar' : 'mostrar'}
              initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
              transition={{ duration: 0.2 }}
              className="flex"
            >
              {visible ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
            </motion.span>
          </AnimatePresence>
        </button>
      }
    />
  );
}
