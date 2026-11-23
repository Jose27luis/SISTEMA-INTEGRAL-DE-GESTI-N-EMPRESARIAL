import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CodigoPermiso } from '@sige/types';
import type { SolicitudSige } from '../../common/auth/authenticated-request';
import { obtenerContextoCliente } from '../../common/auth/client-context';
import { CLAVE_PERMISO } from '../../common/auth/decorators';
import { AuditoriaService } from '../audit/audit.service';

@Injectable()
export class GuardiaPermisos implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditoria: AuditoriaService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const permiso = this.reflector.getAllAndOverride<CodigoPermiso | undefined>(CLAVE_PERMISO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);

    if (permiso === undefined) {
      return true;
    }

    const solicitud = contexto.switchToHttp().getRequest<SolicitudSige>();
    const usuario = solicitud.usuarioAutenticado;

    if (usuario?.permisos.has(permiso) === true) {
      return true;
    }

    await this.auditoria.registrar({
      actor: {
        usuarioId: usuario?.usuarioId ?? null,
        sesionId: usuario?.sesionId ?? null,
        ip: obtenerContextoCliente(solicitud).ip,
      },
      accion: 'PERMISO_DENEGADO',
      entidad: 'permiso',
      entidadId: permiso,
      despues: { metodo: solicitud.method, ruta: solicitud.originalUrl },
    });

    throw new ForbiddenException({
      mensaje: 'No tiene permiso para realizar esta acción.',
      errores: [],
    });
  }
}
