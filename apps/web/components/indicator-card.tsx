import { cn } from '@sige/ui/cn';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface PropiedadesIndicador {
  etiqueta: string;
  valor: string | number;
  detalle?: string;
  enlace?: string;
  tono?: 'normal' | 'alerta' | 'exito';
}

export function Indicador({ etiqueta, valor, detalle, enlace, tono = 'normal' }: PropiedadesIndicador): ReactNode {
  const contenido = (
    <>
      <span className="text-xs font-semibold tracking-wide text-apagado uppercase">{etiqueta}</span>
      <span
        className={cn(
          'font-display text-3xl font-semibold tabular-nums',
          tono === 'alerta' ? 'text-rojo' : tono === 'exito' ? 'text-verde' : 'text-marino',
        )}
      >
        {valor}
      </span>
      {detalle === undefined ? null : <span className="text-xs text-apagado">{detalle}</span>}
    </>
  );
  const clases =
    'flex flex-col gap-1 rounded-lg border border-borde bg-superficie p-4 shadow-[0_1px_2px_rgb(1_41_93/0.04)]';

  return enlace === undefined ? (
    <div className={clases}>{contenido}</div>
  ) : (
    <Link href={enlace} className={cn(clases, 'transition-colors hover:border-marino-claro')}>
      {contenido}
    </Link>
  );
}
