'use client';

import { motion, type Variants } from 'motion/react';
import type { ReactNode } from 'react';

const VARIANTES_APARECER: Variants = {
  oculto: { opacity: 0, y: 16, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

interface PropiedadesAparecer {
  children: ReactNode;
  className?: string;
}

export function Aparecer({ children, className }: PropiedadesAparecer): ReactNode {
  return (
    <motion.div variants={VARIANTES_APARECER} className={className}>
      {children}
    </motion.div>
  );
}
