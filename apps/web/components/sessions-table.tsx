import type { SesionResumen } from '@sige/types';
import { Insignia } from '@sige/ui/components';
import type { ReactNode } from 'react';
import { describirDispositivo, formatearFechaHora } from '@/lib/format';

interface PropiedadesTablaSesiones {
  sesiones: SesionResumen[];
  accion?: (sesion: SesionResumen) => ReactNode;
}

export function TablaSesiones({ sesiones, accion }: PropiedadesTablaSesiones): ReactNode {
  if (sesiones.length === 0) {
    return <p className="text-sm text-apagado">No hay sesiones abiertas.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-borde">
      {sesiones.map((sesion) => (
        <li key={sesion.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-tinta">
              {describirDispositivo(sesion.agenteUsuario)}
              {sesion.actual ? <Insignia tono="exito">Esta sesión</Insignia> : null}
            </span>
            <span className="text-xs text-apagado">
              IP {sesion.ip ?? 'desconocida'} · Inicio {formatearFechaHora(sesion.creadaEn)} · Última actividad{' '}
              {formatearFechaHora(sesion.ultimoUso)}
            </span>
          </div>
          {accion === undefined ? null : accion(sesion)}
        </li>
      ))}
    </ul>
  );
}
