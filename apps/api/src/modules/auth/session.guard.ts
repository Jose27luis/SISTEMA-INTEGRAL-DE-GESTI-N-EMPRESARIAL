import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { SolicitudSige } from '../../common/auth/authenticated-request';
import { extraerTokenPortador } from '../../common/auth/client-context';
import { CLAVE_PERMITIR_PENDIENTES, CLAVE_PUBLICO } from '../../common/auth/decorators';
import { PerfilAccesoService } from './access-profile.service';
import { SesionesService } from './sessions.service';

@Injectable()
export class GuardiaSesion implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sesiones: SesionesService,
    private readonly perfilAcceso: PerfilAccesoService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const objetivos = [contexto.getHandler(), contexto.getClass()];

    if (this.reflector.getAllAndOverride<boolean | undefined>(CLAVE_PUBLICO, objetivos) === true) {
      return true;
    }

    const solicitud = contexto.switchToHttp().getRequest<SolicitudSige>();
    const token = extraerTokenPortador(solicitud);

    if (token === null) {
      throw new UnauthorizedException({ mensaje: 'Inicie sesión para continuar.', errores: [] });
    }

    const sesion = await this.sesiones.validar(token);

    if (sesion === null) {
      throw new UnauthorizedException({
        mensaje: 'Su sesión expiró o fue cerrada. Inicie sesión nuevamente.',
        errores: [],
      });
    }

    const acceso = await this.perfilAcceso.resolverAcceso(sesion.usuario);

    solicitud.usuarioAutenticado = {
      usuarioId: sesion.usuario.id,
      sesionId: sesion.sesionId,
      permisos: acceso.permisos,
      alcanceGlobal: acceso.alcanceGlobal,
      alcance: acceso.alcance,
      pendientes: acceso.pendientes,
    };

    const permiteConPendientes =
      this.reflector.getAllAndOverride<boolean | undefined>(CLAVE_PERMITIR_PENDIENTES, objetivos) === true;

    if (acceso.pendientes.length > 0 && !permiteConPendientes) {
      throw new ForbiddenException({
        mensaje: 'Complete la configuración de seguridad de su cuenta para continuar.',
        errores: [],
      });
    }

    return true;
  }
}
