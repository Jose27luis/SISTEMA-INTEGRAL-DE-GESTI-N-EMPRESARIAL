import type { CodigoPermiso, PendienteIngreso } from '@sige/types';
import type { Request } from 'express';

export interface UsuarioAutenticado {
  usuarioId: string;
  sesionId: string;
  permisos: ReadonlySet<CodigoPermiso>;
  alcanceGlobal: boolean;
  pendientes: readonly PendienteIngreso[];
}

export interface ContextoCliente {
  ip: string | null;
  agenteUsuario: string | null;
}

export interface SolicitudSige extends Request {
  usuarioAutenticado?: UsuarioAutenticado;
}
