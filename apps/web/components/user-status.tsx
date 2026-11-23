import type { UsuarioResumen } from '@sige/types';
import { Insignia } from '@sige/ui/components';
import type { ReactNode } from 'react';
import { formatearFechaHora } from '@/lib/format';

interface PropiedadesEstadoUsuario {
  usuario: Pick<UsuarioResumen, 'activo' | 'bloqueadoHasta' | 'mfaActivo'>;
}

export function EstadoUsuario({ usuario }: PropiedadesEstadoUsuario): ReactNode {
  return (
    <span className="flex flex-wrap gap-1.5">
      {usuario.activo ? <Insignia tono="exito">Activo</Insignia> : <Insignia tono="peligro">Inactivo</Insignia>}
      {usuario.bloqueadoHasta === null ? null : (
        <Insignia tono="aviso">Bloqueado hasta {formatearFechaHora(usuario.bloqueadoHasta)}</Insignia>
      )}
      {usuario.mfaActivo ? <Insignia tono="info">MFA</Insignia> : <Insignia>Sin MFA</Insignia>}
    </span>
  );
}
