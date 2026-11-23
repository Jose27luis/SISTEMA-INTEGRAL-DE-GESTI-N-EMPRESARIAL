import { Controller, Get, HttpCode, type MessageEvent, Param, Post, Query, Sse } from '@nestjs/common';
import type { PaginaNotificaciones, ResumenNotificaciones } from '@sige/types';
import type { Observable } from 'rxjs';
import { z } from 'zod';
import type { UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { UsuarioActual } from '../../common/auth/decorators';
import { ValidacionZod } from '../../common/validation/zod-validation.pipe';
import { ConsultaNotificacionesService } from './notifications-query.service';
import { FlujoNotificacionesService } from './notifications-stream.service';

@Controller('notificaciones')
export class NotificacionesController {
  constructor(
    private readonly consulta: ConsultaNotificacionesService,
    private readonly flujo: FlujoNotificacionesService,
  ) {}

  @Get()
  listar(
    @Query('pagina', new ValidacionZod(z.coerce.number().int().positive().max(100000).default(1))) pagina: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<PaginaNotificaciones> {
    return this.consulta.listar(usuario.usuarioId, pagina);
  }

  @Get('resumen')
  resumen(@UsuarioActual() usuario: UsuarioAutenticado): Promise<ResumenNotificaciones> {
    return this.consulta.resumen(usuario.usuarioId);
  }

  @Sse('eventos')
  eventos(@UsuarioActual() usuario: UsuarioAutenticado): Observable<MessageEvent> {
    return this.flujo.flujo(usuario.usuarioId);
  }

  @Post('lectura')
  @HttpCode(204)
  marcarTodas(@UsuarioActual() usuario: UsuarioAutenticado): Promise<void> {
    return this.consulta.marcarTodas(usuario.usuarioId);
  }

  @Post(':id/lectura')
  @HttpCode(204)
  marcarLeida(
    @Param('id', new ValidacionZod(z.uuid())) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    return this.consulta.marcarLeida(usuario.usuarioId, id);
  }
}
