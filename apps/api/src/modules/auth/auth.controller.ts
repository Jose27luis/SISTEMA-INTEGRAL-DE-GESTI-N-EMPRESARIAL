import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import {
  type ActivacionMfa,
  type CambioContrasena,
  type CodigosRecuperacion,
  type ConfiguracionMfa,
  esquemaActivacionMfa,
  esquemaCambioContrasena,
  esquemaInicioSesion,
  esquemaVerificacionMfa,
  type InicioSesion,
  type Perfil,
  type RespuestaInicioSesion,
  type SesionIniciada,
  type SesionResumen,
  type VerificacionMfa,
} from '@sige/types';
import { z } from 'zod';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import {
  Cliente,
  PermitirConPendientes,
  Publico,
  UsuarioActual,
} from '../../common/auth/decorators';
import { ValidacionZod } from '../../common/validation/zod-validation.pipe';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
import { PerfilAccesoService } from './access-profile.service';
import { GuardiaLimiteIngreso } from './login-rate-limit.guard';
import { IngresoService } from './login.service';
import { ConfiguracionMfaService } from './mfa-setup.service';
import { CambioContrasenaService } from './password-change.service';
import { SesionesService } from './sessions.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly ingreso: IngresoService,
    private readonly perfilAcceso: PerfilAccesoService,
    private readonly configuracionMfa: ConfiguracionMfaService,
    private readonly cambioContrasena: CambioContrasenaService,
    private readonly sesiones: SesionesService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Post('ingreso')
  @Publico()
  @UseGuards(GuardiaLimiteIngreso)
  @HttpCode(200)
  iniciar(
    @Body(new ValidacionZod(esquemaInicioSesion)) datos: InicioSesion,
    @Cliente() cliente: ContextoCliente,
  ): Promise<RespuestaInicioSesion> {
    return this.ingreso.iniciar(datos, cliente);
  }

  @Post('mfa/verificacion')
  @Publico()
  @UseGuards(GuardiaLimiteIngreso)
  @HttpCode(200)
  verificarMfa(
    @Body(new ValidacionZod(esquemaVerificacionMfa)) datos: VerificacionMfa,
    @Cliente() cliente: ContextoCliente,
  ): Promise<SesionIniciada> {
    return this.ingreso.verificarMfa(datos, cliente);
  }

  @Post('salida')
  @PermitirConPendientes()
  @HttpCode(204)
  salir(@UsuarioActual() usuario: UsuarioAutenticado, @Cliente() cliente: ContextoCliente): Promise<void> {
    return this.ingreso.salir(usuario, cliente);
  }

  @Get('perfil')
  @PermitirConPendientes()
  perfil(@UsuarioActual() usuario: UsuarioAutenticado): Promise<Perfil> {
    return this.perfilAcceso.obtenerPerfil(usuario);
  }

  @Post('contrasena')
  @PermitirConPendientes()
  @HttpCode(204)
  cambiarContrasena(
    @Body(new ValidacionZod(esquemaCambioContrasena)) datos: CambioContrasena,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    return this.cambioContrasena.cambiar(usuario, datos, cliente);
  }

  @Post('mfa/configuracion')
  @PermitirConPendientes()
  @HttpCode(200)
  iniciarMfa(@UsuarioActual() usuario: UsuarioAutenticado): Promise<ConfiguracionMfa> {
    return this.configuracionMfa.iniciar(usuario);
  }

  @Post('mfa/activacion')
  @PermitirConPendientes()
  @HttpCode(200)
  activarMfa(
    @Body(new ValidacionZod(esquemaActivacionMfa)) datos: ActivacionMfa,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<CodigosRecuperacion> {
    return this.configuracionMfa.activar(usuario, datos.codigo, cliente);
  }

  @Get('sesiones')
  listarSesiones(@UsuarioActual() usuario: UsuarioAutenticado): Promise<SesionResumen[]> {
    return this.sesiones.listarVigentes(usuario.usuarioId, usuario.sesionId);
  }

  @Post('sesiones/:id/cierre')
  @HttpCode(204)
  async cerrarSesion(
    @Param('id', new ValidacionZod(z.uuid())) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<void> {
    await this.sesiones.revocarPropia(id, usuario.usuarioId, 'Cerrada por el usuario desde otra sesión');
    await this.auditoria.registrar({
      actor: actorDesde(usuario, cliente),
      accion: 'REVOCAR_SESION',
      entidad: 'sesion',
      entidadId: id,
    });
  }
}
