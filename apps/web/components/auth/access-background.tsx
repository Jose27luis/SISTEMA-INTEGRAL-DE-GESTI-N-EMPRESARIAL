'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

export function AmbienteAcceso(): ReactNode {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <motion.div
        className="absolute -top-24 -right-24 size-96 rounded-full bg-marino-claro/15 blur-3xl"
        animate={{ x: [0, -50, 0], y: [0, 40, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-0 -left-20 size-80 rounded-full bg-verde/12 blur-3xl"
        animate={{ x: [0, 40, 0], y: [0, -40, 0] }}
        transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/3 left-1/4 size-56 rounded-full bg-dorado/15 blur-3xl"
        animate={{ x: [0, 30, -20, 0], y: [0, 20, -10, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(1,41,93,0.07)_1px,transparent_0)] [background-size:24px_24px]" />
    </div>
  );
}
