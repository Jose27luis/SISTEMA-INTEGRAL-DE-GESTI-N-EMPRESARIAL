import Image from 'next/image';
import type { ReactNode } from 'react';

interface PropiedadesMarca {
  claro?: boolean;
}

export function Marca({ claro = false }: PropiedadesMarca): ReactNode {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white p-1.5 shadow-sm">
        <Image src="/brand/torres-mark.png" alt="" width={707} height={524} className="h-auto w-full" priority />
      </span>
      <span className="flex flex-col leading-tight">
        <span
          className={
            claro
              ? 'font-display text-base font-semibold tracking-wide text-white'
              : 'font-display text-base font-semibold tracking-wide text-marino'
          }
        >
          TORRES ASOCIADOS
        </span>
        <span className={claro ? 'text-xs text-white/65' : 'text-xs text-apagado'}>
          Sistema de Gestión Empresarial
        </span>
      </span>
    </div>
  );
}
