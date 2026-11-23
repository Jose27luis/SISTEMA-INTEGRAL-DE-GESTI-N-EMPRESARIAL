'use server';

import {
  esquemaInicioSesion,
  esquemaRespuestaInicioSesion,
  esquemaSesionIniciada,
  esquemaVerificacionMfa,
} from '@sige/types';
import { redirect } from 'next/navigation';
import { solicitarApi } from '@/lib/api';
import { type EstadoFormulario, estadoConError, leerTexto } from '@/lib/form-state';
import {
  eliminarDesafio,
  guardarDesafio,
  guardarSesion,
  leerDesafio,
} from '@/lib/session-cookie';

export async function iniciarSesion(
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const valores = { correo: leerTexto(datos, 'correo') };
  const entrada = esquemaInicioSesion.safeParse({
    correo: valores.correo,
    contrasena: leerTexto(datos, 'contrasena'),
  });

  if (!entrada.success) {
    return estadoConError(
      {
        mensaje: 'Ingrese un correo válido y su contraseña.',
        errores: entrada.error.issues.map((problema) => ({
          campo: problema.path.map(String).join('.'),
          mensaje: problema.path[0] === 'correo' ? 'Ingrese un correo válido.' : 'Ingrese su contraseña.',
        })),
      },
      valores,
    );
  }

  const resultado = await solicitarApi('/auth/ingreso', {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: esquemaRespuestaInicioSesion,
    autenticado: false,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  if (resultado.datos.estado === 'MFA_REQUERIDO') {
    await guardarDesafio(resultado.datos.desafioId);
    redirect('/ingresar/verificacion');
  }

  await guardarSesion(resultado.datos.token, resultado.datos.expiraEn);
  redirect('/inicio');
}

export async function verificarCodigo(
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const desafioId = await leerDesafio();

  if (desafioId === null) {
    redirect('/ingresar?motivo=verificacion-vencida');
  }

  const entrada = esquemaVerificacionMfa.safeParse({ desafioId, codigo: leerTexto(datos, 'codigo') });

  if (!entrada.success) {
    return estadoConError({
      mensaje: 'Revise el código ingresado.',
      errores: [
        {
          campo: 'codigo',
          mensaje: 'Ingrese los 6 dígitos de su aplicación o un código de recuperación (XXXX-XXXX).',
        },
      ],
    });
  }

  const resultado = await solicitarApi('/auth/mfa/verificacion', {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: esquemaSesionIniciada,
    autenticado: false,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error);
  }

  await eliminarDesafio();
  await guardarSesion(resultado.datos.token, resultado.datos.expiraEn);
  redirect('/inicio');
}
