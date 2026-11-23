import {
  createParamDecorator,
  type CustomDecorator,
  type ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import type { CodigoPermiso } from '@sige/types';
import type {
  ContextoCliente,
  SolicitudSige,
  UsuarioAutenticado,
} from './authenticated-request';
import { obtenerContextoCliente } from './client-context';

export const CLAVE_PUBLICO = 'sige:publico';
export const CLAVE_PERMITIR_PENDIENTES = 'sige:permitir-pendientes';
export const CLAVE_PERMISO = 'sige:permiso';

export function Publico(): CustomDecorator {
  return SetMetadata(CLAVE_PUBLICO, true);
}

export function PermitirConPendientes(): CustomDecorator {
  return SetMetadata(CLAVE_PERMITIR_PENDIENTES, true);
}

export function RequierePermiso(permiso: CodigoPermiso): CustomDecorator {
  return SetMetadata(CLAVE_PERMISO, permiso);
}

export const UsuarioActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): UsuarioAutenticado => {
    const solicitud = contexto.switchToHttp().getRequest<SolicitudSige>();

    if (solicitud.usuarioAutenticado === undefined) {
      throw new UnauthorizedException({ mensaje: 'Inicie sesión para continuar.', errores: [] });
    }

    return solicitud.usuarioAutenticado;
  },
);

export const Cliente = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): ContextoCliente =>
    obtenerContextoCliente(contexto.switchToHttp().getRequest<SolicitudSige>()),
);
