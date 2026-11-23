'use server';

import {
  esquemaAsignacionRoles,
  esquemaMotivo,
  esquemaRestablecimientoContrasena,
  esquemaUsuarioDetalle,
} from '@sige/types';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { solicitarApi } from '@/lib/api';
import {
  type EstadoFormulario,
  estadoConError,
  estadoExitoso,
  leerLista,
  leerOpcional,
  leerTexto,
} from '@/lib/form-state';

const ERROR_USUARIO: EstadoFormulario = estadoConError({ mensaje: 'Usuario no válido.', errores: [] });

type ResultadoMotivo = { ok: true; motivo: string } | { ok: false; estado: EstadoFormulario };

function validarMotivoConfirmado(usuarioId: string, datos: FormData): ResultadoMotivo {
  if (!z.uuid().safeParse(usuarioId).success) {
    return { ok: false, estado: ERROR_USUARIO };
  }

  const valores = { motivo: leerTexto(datos, 'motivo') };

  if (leerTexto(datos, 'confirmacion') !== 'si') {
    return {
      ok: false,
      estado: estadoConError(
        {
          mensaje: 'Confirme la acción para continuar.',
          errores: [{ campo: 'confirmacion', mensaje: 'Marque la casilla de confirmación.' }],
        },
        valores,
      ),
    };
  }

  const entrada = esquemaMotivo.safeParse(valores);

  if (!entrada.success) {
    return {
      ok: false,
      estado: estadoConError(
        {
          mensaje: 'Revise los datos ingresados.',
          errores: [{ campo: 'motivo', mensaje: 'Describa el motivo en al menos 5 caracteres.' }],
        },
        valores,
      ),
    };
  }

  return { ok: true, motivo: entrada.data.motivo };
}

async function ejecutarConMotivo(
  usuarioId: string,
  accion: string,
  datos: FormData,
  mensajeExito: string,
  adicionales: Record<string, unknown> = {},
): Promise<EstadoFormulario> {
  const validacion = validarMotivoConfirmado(usuarioId, datos);

  if (!validacion.ok) {
    return validacion.estado;
  }

  const resultado = await solicitarApi(`/usuarios/${usuarioId}/${accion}`, {
    metodo: 'POST',
    cuerpo: { motivo: validacion.motivo, ...adicionales },
    esquema: esquemaUsuarioDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, { motivo: validacion.motivo });
  }

  revalidatePath('/configuracion/usuarios', 'layout');
  return estadoExitoso(mensajeExito);
}

export async function restablecerContrasena(
  usuarioId: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const validacion = validarMotivoConfirmado(usuarioId, datos);

  if (!validacion.ok) {
    return validacion.estado;
  }

  const valores = { motivo: validacion.motivo };
  const contrasena = leerTexto(datos, 'contrasena');

  if (contrasena !== leerTexto(datos, 'repeticion')) {
    return estadoConError(
      {
        mensaje: 'Revise los datos ingresados.',
        errores: [{ campo: 'repeticion', mensaje: 'Las contraseñas no coinciden.' }],
      },
      valores,
    );
  }

  const entrada = esquemaRestablecimientoContrasena.safeParse({ contrasena, motivo: validacion.motivo });

  if (!entrada.success) {
    return estadoConError(
      {
        mensaje: 'Revise los datos ingresados.',
        errores: entrada.error.issues.map((problema) => ({
          campo: String(problema.path[0] ?? ''),
          mensaje: problema.message,
        })),
      },
      valores,
    );
  }

  const resultado = await solicitarApi(`/usuarios/${usuarioId}/restablecimiento-contrasena`, {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: esquemaUsuarioDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath('/configuracion/usuarios', 'layout');
  return estadoExitoso('Contraseña actualizada. Se cerraron las sesiones abiertas del usuario.');
}

export async function asignarRoles(
  usuarioId: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(usuarioId).success) {
    return ERROR_USUARIO;
  }

  const entrada = esquemaAsignacionRoles.safeParse({ rolIds: leerLista(datos, 'rolIds') });

  if (!entrada.success) {
    return estadoConError({ mensaje: 'La selección de roles no es válida.', errores: [] });
  }

  const resultado = await solicitarApi(`/usuarios/${usuarioId}/roles`, {
    metodo: 'PUT',
    cuerpo: entrada.data,
    esquema: esquemaUsuarioDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error);
  }

  revalidatePath('/configuracion/usuarios', 'layout');
  return estadoExitoso('Roles actualizados.');
}

export async function revocarSesiones(
  usuarioId: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarConMotivo(usuarioId, 'revocacion-sesiones', datos, 'Se cerraron todas sus sesiones.');
}

export async function restablecerMfa(
  usuarioId: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarConMotivo(
    usuarioId,
    'restablecimiento-mfa',
    datos,
    'Verificación en dos pasos restablecida. Deberá configurarla nuevamente.',
  );
}

export async function desactivarUsuario(
  usuarioId: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarConMotivo(usuarioId, 'desactivacion', datos, 'Usuario desactivado y sesiones cerradas.', {
    reasignarAId: leerOpcional(datos, 'reasignarAId'),
  });
}

export async function activarUsuario(
  usuarioId: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return ejecutarConMotivo(usuarioId, 'activacion', datos, 'Usuario activado.');
}
