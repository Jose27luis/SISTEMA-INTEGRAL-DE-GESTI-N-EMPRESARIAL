'use client';

import { motion, MotionConfig, stagger, type Variants } from 'motion/react';
import Image from 'next/image';
import type { ReactNode } from 'react';

const VARIANTES_TARJETA: Variants = {
  oculto: { opacity: 0, y: 32, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
      when: 'beforeChildren',
      delayChildren: stagger(0.08),
    },
  },
};

const VARIANTES_LOGO: Variants = {
  oculto: { opacity: 0, scale: 0.8, rotate: -4 },
  visible: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: { type: 'spring', stiffness: 220, damping: 18 },
  },
};

interface PropiedadesTarjetaAcceso {
  children: ReactNode;
}

export function TarjetaAcceso({ children }: PropiedadesTarjetaAcceso): ReactNode {
  return (
    <MotionConfig reducedMotion="user">
    <motion.div
      variants={VARIANTES_TARJETA}
      initial="oculto"
      animate="visible"
      className="relative w-full max-w-[28rem] overflow-hidden rounded-3xl border border-white/70 bg-superficie/90 px-6 pt-8 pb-8 shadow-[0_30px_80px_-24px_rgba(1,41,93,0.45)] backdrop-blur-xl sm:px-10 sm:pb-10"
    >
      <div aria-hidden="true" className="absolute inset-x-0 top-0 flex h-1.5">
        <span className="flex-1 bg-marino" />
        <span className="flex-1 bg-dorado" />
        <span className="flex-1 bg-verde" />
      </div>
      <motion.div variants={VARIANTES_LOGO} className="mb-6 flex justify-center">
        <motion.div
          whileHover={{ scale: 1.04, rotate: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        >
          <Image
            src="/brand/torres-logo.png"
            alt="TORRES ASOCIADOS – Confianza que genera resultados"
            width={1254}
            height={1254}
            className="h-36 w-auto sm:h-40"
            priority
          />
        </motion.div>
      </motion.div>
      <div className="flex flex-col gap-6">{children}</div>
    </motion.div>
    </MotionConfig>
  );
}
