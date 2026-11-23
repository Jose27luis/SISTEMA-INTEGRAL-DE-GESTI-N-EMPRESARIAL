import type { ReactNode } from 'react';

interface PropiedadesMarca {
  claro?: boolean;
}

export function Marca({ claro = false }: PropiedadesMarca): ReactNode {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-xs font-semibold tracking-[0.2em] text-dorado uppercase">TORRES ASOCIADOS</span>
      <span className={claro ? 'text-sm font-semibold text-white' : 'text-sm font-semibold text-marino'}>
        Sistema de Gestión Empresarial
      </span>
    </div>
  );
}
