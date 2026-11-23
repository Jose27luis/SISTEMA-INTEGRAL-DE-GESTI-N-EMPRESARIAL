import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { esquemaErrorApi, type ErrorApi } from '@sige/types';
import type { Response } from 'express';
import { z } from 'zod';

const MENSAJES_POR_ESTADO: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'La solicitud no es válida.',
  [HttpStatus.UNAUTHORIZED]: 'Inicie sesión para continuar.',
  [HttpStatus.FORBIDDEN]: 'No tiene permiso para realizar esta acción.',
  [HttpStatus.NOT_FOUND]: 'El recurso solicitado no existe.',
  [HttpStatus.CONFLICT]: 'La operación entra en conflicto con el estado actual.',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Demasiados intentos. Espere un minuto e intente nuevamente.',
};

const esquemaMensajeNest = z.object({
  message: z.union([z.string(), z.array(z.string())]),
});

function normalizarCuerpo(cuerpo: string | object, estado: number): ErrorApi {
  const propio = esquemaErrorApi.safeParse(cuerpo);

  if (propio.success) {
    return propio.data;
  }

  const traducido = MENSAJES_POR_ESTADO[estado];

  if (traducido !== undefined) {
    return { mensaje: traducido, errores: [] };
  }

  const nest = esquemaMensajeNest.safeParse(cuerpo);

  if (nest.success) {
    const mensaje = nest.data.message;
    return { mensaje: Array.isArray(mensaje) ? mensaje.join(' ') : mensaje, errores: [] };
  }

  return { mensaje: 'La solicitud no pudo completarse.', errores: [] };
}

@Catch()
export class FiltroExcepciones implements ExceptionFilter {
  private readonly registro = new Logger(FiltroExcepciones.name);

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const respuesta = host.switchToHttp().getResponse<Response>();

    if (excepcion instanceof HttpException) {
      const estado = excepcion.getStatus();
      respuesta.status(estado).json(normalizarCuerpo(excepcion.getResponse(), estado));
      return;
    }

    this.registro.error(
      excepcion instanceof Error ? (excepcion.stack ?? excepcion.message) : String(excepcion),
    );

    const cuerpo: ErrorApi = {
      mensaje: 'Ocurrió un error interno. Intente nuevamente.',
      errores: [],
    };

    respuesta.status(HttpStatus.INTERNAL_SERVER_ERROR).json(cuerpo);
  }
}
