'use client';

import { CircleCheck } from 'lucide-react';
import { motion, MotionConfig, stagger, type Variants } from 'motion/react';
import Image from 'next/image';
import type { ReactNode } from 'react';

const PILARES = [
  'Tareas con responsable, fecha límite y evidencia',
  'Revisión y aprobación de cada trabajo',
  'Expediente digital de cada cliente',
] as const;

const BARRAS = [
  { alto: 'h-40', color: 'bg-verde', retraso: 0.2 },
  { alto: 'h-64', color: 'bg-dorado', retraso: 0.35 },
  { alto: 'h-96', color: 'bg-verde', retraso: 0.5 },
] as const;

const VARIANTES_PANEL: Variants = {
  oculto: {},
  visible: { transition: { delayChildren: stagger(0.12, { startDelay: 0.15 }) } },
};

const VARIANTES_ELEMENTO: Variants = {
  oculto: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

const VARIANTES_PILAR: Variants = {
  oculto: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

export function PanelMarca(): ReactNode {
  const anio = new Date().getFullYear();

  return (
    <MotionConfig reducedMotion="user">
    <motion.aside
      variants={VARIANTES_PANEL}
      initial="oculto"
      animate="visible"
      className="relative hidden flex-col justify-between overflow-hidden bg-marino p-12 text-white lg:flex xl:p-16"
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-40 size-[36rem] rounded-full bg-marino-claro/50 blur-3xl"
        animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 bottom-10 size-80 rounded-full bg-verde/25 blur-3xl"
        animate={{ x: [0, -40, 0], y: [0, -30, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div aria-hidden="true" className="pointer-events-none absolute right-14 bottom-0 flex items-end gap-4">
        {BARRAS.map((barra) => (
          <motion.span
            key={barra.retraso}
            className={`${barra.alto} ${barra.color} block w-16 origin-bottom rounded-t-md opacity-30`}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: [0, 1, 0.92, 1] }}
            transition={{
              duration: 1.4,
              delay: barra.retraso,
              ease: [0.16, 1, 0.3, 1],
              times: [0, 0.6, 0.8, 1],
            }}
          />
        ))}
      </div>

      <motion.div variants={VARIANTES_ELEMENTO} className="relative flex items-center gap-4">
        <motion.span
          className="flex size-16 items-center justify-center rounded-2xl bg-white p-2.5 shadow-lg"
          whileHover={{ rotate: -6, scale: 1.06 }}
          transition={{ type: 'spring', stiffness: 300, damping: 14 }}
        >
          <Image src="/brand/torres-mark.png" alt="" width={707} height={524} className="h-auto w-full" priority />
        </motion.span>
        <span className="flex flex-col leading-tight">
          <span className="font-display text-xl font-semibold tracking-wide">TORRES ASOCIADOS</span>
          <span className="text-sm text-white/70">Sistema de Gestión Empresarial</span>
        </span>
      </motion.div>

      <div className="relative flex max-w-lg flex-col gap-8">
        <motion.div variants={VARIANTES_ELEMENTO} className="flex flex-col gap-4">
          <motion.span
            className="block h-1 w-16 origin-left rounded-full bg-dorado"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
          <p className="font-display text-4xl leading-tight font-semibold xl:text-5xl">
            Cada actividad tiene un responsable.
          </p>
          <p className="text-lg text-white/75">Cada avance queda registrado y cada resultado puede medirse.</p>
        </motion.div>
        <motion.ul variants={VARIANTES_PANEL} className="flex flex-col gap-3">
          {PILARES.map((pilar) => (
            <motion.li key={pilar} variants={VARIANTES_PILAR} className="flex items-center gap-3 text-white/85">
              <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-dorado" />
              {pilar}
            </motion.li>
          ))}
        </motion.ul>
      </div>

      <motion.p variants={VARIANTES_ELEMENTO} className="relative text-sm text-white/55">
        Confianza que genera resultados · © {anio} TORRES ASOCIADOS S.A.C.
      </motion.p>
    </motion.aside>
    </MotionConfig>
  );
}
