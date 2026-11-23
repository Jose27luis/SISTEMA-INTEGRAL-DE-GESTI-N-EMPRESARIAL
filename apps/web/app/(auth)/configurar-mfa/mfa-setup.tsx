'use client';

import { Alerta, Campo } from '@sige/ui/components';
import Link from 'next/link';
import { type ReactNode, useActionState } from 'react';
import { BotonEnvio } from '@/components/submit-button';
import { avanzarConfiguracionMfa } from './actions';
import { ESTADO_INICIAL_MFA } from './mfa-state';

export function ConfiguradorMfa(): ReactNode {
  const [estado, accion] = useActionState(avanzarConfiguracionMfa, ESTADO_INICIAL_MFA);

  if (estado.etapa === 'activada') {
    return (
      <div className="flex flex-col gap-4">
        <Alerta tono="exito" titulo="Verificación en dos pasos activada">
          Desde ahora, al ingresar se le pedirá el código de su aplicación.
        </Alerta>
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold text-marino">Códigos de recuperación</h2>
          <p className="text-sm text-apagado">
            Guárdelos en un lugar seguro, fuera de esta computadora. Cada código sirve una sola vez para
            ingresar si pierde su teléfono. No se volverán a mostrar.
          </p>
          <ul className="grid grid-cols-2 gap-2 rounded-md border border-borde bg-fondo p-4 font-mono text-sm">
            {estado.codigos.map((codigo) => (
              <li key={codigo}>{codigo}</li>
            ))}
          </ul>
        </div>
        <Link
          href="/inicio"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-marino px-4 text-sm font-semibold text-white hover:bg-marino-medio"
        >
          Ya guardé mis códigos, continuar
        </Link>
      </div>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      {estado.mensaje === null ? null : <Alerta tono="error">{estado.mensaje}</Alerta>}
      {estado.configuracion === null ? (
        <>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-tinta">
            <li>Instale en su teléfono una aplicación autenticadora (Google Authenticator, Microsoft Authenticator u otra compatible con TOTP).</li>
            <li>Genere el código QR y escanéelo con la aplicación.</li>
            <li>Ingrese el código de 6 dígitos que muestre la aplicación.</li>
          </ol>
          <BotonEnvio textoPendiente="Generando…" className="w-full">
            Generar código QR
          </BotonEnvio>
        </>
      ) : (
        <>
          <div
            className="mx-auto w-56 rounded-md border border-borde bg-white p-2"
            role="img"
            aria-label="Código QR para configurar la aplicación autenticadora"
            dangerouslySetInnerHTML={{ __html: estado.configuracion.qrSvg }}
          />
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-marino-claro">
              ¿No puede escanear? Ingrese la clave manualmente
            </summary>
            <p className="mt-2 rounded-md bg-fondo p-3 font-mono text-sm break-all">{estado.configuracion.secreto}</p>
          </details>
          <Campo
            id="codigo"
            name="codigo"
            etiqueta="Código de 6 dígitos"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            error={estado.errorCodigo ?? undefined}
          />
          <BotonEnvio textoPendiente="Activando…" className="w-full">
            Activar verificación en dos pasos
          </BotonEnvio>
        </>
      )}
    </form>
  );
}
