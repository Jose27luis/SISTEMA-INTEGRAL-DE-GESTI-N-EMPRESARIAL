'use client';

import { ArrowRight, CircleAlert, CircleCheck, KeyRound } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { type ReactNode, useActionState } from 'react';
import { BotonAcceso } from '@/components/auth/access-button';
import { CampoAcceso } from '@/components/auth/access-field';
import { Aparecer } from '@/components/auth/appear';
import { avanzarConfiguracionMfa } from './actions';
import { ESTADO_INICIAL_MFA } from './mfa-state';

const PASOS = [
  'Instale en su teléfono una aplicación autenticadora (Google Authenticator, Microsoft Authenticator u otra compatible con TOTP).',
  'Genere el código QR y escanéelo con la aplicación.',
  'Ingrese el código de 6 dígitos que muestre la aplicación.',
] as const;

const TRANSICION_ETAPA = { duration: 0.4, ease: [0.16, 1, 0.3, 1] } as const;

export function ConfiguradorMfa(): ReactNode {
  const [estado, accion] = useActionState(avanzarConfiguracionMfa, ESTADO_INICIAL_MFA);

  return (
    <Aparecer>
      <AnimatePresence mode="wait">
        {estado.etapa === 'activada' ? (
          <motion.div
            key="activada"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={TRANSICION_ETAPA}
            className="flex flex-col gap-5"
          >
            <div role="status" className="flex flex-col items-center gap-2 text-center">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
                className="flex size-14 items-center justify-center rounded-full bg-verde-suave text-verde"
              >
                <CircleCheck aria-hidden="true" className="size-8" />
              </motion.span>
              <p className="font-semibold text-verde-oscuro">Verificación en dos pasos activada</p>
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="font-semibold text-marino">Códigos de recuperación</h2>
              <p className="text-sm text-apagado">
                Guárdelos fuera de esta computadora. Cada uno sirve una sola vez si pierde su teléfono y no se
                volverán a mostrar.
              </p>
              <ul className="grid grid-cols-2 gap-2 rounded-xl border border-borde bg-fondo p-4 font-mono text-sm">
                {estado.codigos.map((codigo, indice) => (
                  <motion.li
                    key={codigo}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + indice * 0.04 }}
                  >
                    {codigo}
                  </motion.li>
                ))}
              </ul>
            </div>
            <Link
              href="/inicio"
              className="group flex h-13 items-center justify-center gap-2 rounded-xl bg-marino text-base font-semibold text-white transition-shadow hover:shadow-[0_18px_36px_-14px_rgba(1,41,93,0.65)]"
            >
              Ya guardé mis códigos, continuar
              <ArrowRight aria-hidden="true" className="size-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        ) : (
          <motion.form
            key={estado.configuracion === null ? 'inicio' : 'escaneo'}
            action={accion}
            noValidate
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={TRANSICION_ETAPA}
            className="flex flex-col gap-5"
          >
            {estado.mensaje === null ? null : (
              <p
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-rojo/25 bg-rojo-suave px-4 py-3 text-sm font-medium text-rojo"
              >
                <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                {estado.mensaje}
              </p>
            )}
            {estado.configuracion === null ? (
              <>
                <ol className="flex flex-col gap-3">
                  {PASOS.map((paso, indice) => (
                    <li key={paso} className="flex items-start gap-3 text-sm text-tinta">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-marino text-xs font-bold text-white">
                        {indice + 1}
                      </span>
                      {paso}
                    </li>
                  ))}
                </ol>
                <BotonAcceso textoPendiente="Generando…">Generar código QR</BotonAcceso>
              </>
            ) : (
              <>
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, rotate: -2 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 16 }}
                  className="mx-auto w-56 rounded-2xl border border-borde bg-white p-3 shadow-lg"
                  role="img"
                  aria-label="Código QR para configurar la aplicación autenticadora"
                  dangerouslySetInnerHTML={{ __html: estado.configuracion.qrSvg }}
                />
                <details className="text-sm">
                  <summary className="cursor-pointer text-center font-medium text-marino-claro">
                    ¿No puede escanear? Ingrese la clave manualmente
                  </summary>
                  <p className="mt-2 rounded-xl bg-fondo p-3 text-center font-mono text-sm break-all">
                    {estado.configuracion.secreto}
                  </p>
                </details>
                <CampoAcceso
                  id="codigo"
                  name="codigo"
                  etiqueta="Código de 6 dígitos"
                  icono={KeyRound}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  autoFocus
                  className="font-mono text-xl tracking-[0.35em]"
                  error={estado.errorCodigo ?? undefined}
                />
                <BotonAcceso textoPendiente="Activando…">Activar verificación</BotonAcceso>
              </>
            )}
          </motion.form>
        )}
      </AnimatePresence>
    </Aparecer>
  );
}
