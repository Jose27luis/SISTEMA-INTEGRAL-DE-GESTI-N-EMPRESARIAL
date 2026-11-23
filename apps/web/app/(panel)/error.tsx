'use client';

import { Alerta, Boton } from '@sige/ui/components';
import type { ReactNode } from 'react';

interface PropiedadesErrorPanel {
  error: Error;
  reset: () => void;
}

export default function ErrorPanel({ error, reset }: PropiedadesErrorPanel): ReactNode {
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Alerta tono="error" titulo="No se pudo cargar esta página">
        {error.message}
      </Alerta>
      <Boton variante="secundario" onClick={reset} className="self-start">
        Intentar nuevamente
      </Boton>
    </div>
  );
}
