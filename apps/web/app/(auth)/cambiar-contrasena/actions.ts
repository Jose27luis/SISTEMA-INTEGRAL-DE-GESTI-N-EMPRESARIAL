'use server';

import { esquemaCambioContrasena } from '@sige/types';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { solicitarApi } from '@/lib/api';
import { type EstadoFormulario, estadoConError, leerTexto } from '@/lib/form-state';

export async function cambiarContrasena(
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const actual = leerTexto(datos, 'actual');
  const nueva = leerTexto(datos, 'nueva');

  if (nueva !== leerTexto(datos, 'confirmacion')) {
    return estadoConError({
      mensaje: 'Revise los datos ingresados.',
      errores: [{ campo: 'confirmacion', mensaje: 'La confirmación no coincide con la nueva contraseña.' }],
    });
  }

  const entrada = esquemaCambioContrasena.safeParse({ actual, nueva });

  if (!entrada.success) {
    return estadoConError({
      mensaje: 'Revise los datos ingresados.',
      errores: entrada.error.issues.map((problema) => ({
        campo: problema.path.map(String).join('.'),
        mensaje: problema.path[0] === 'nueva' ? problema.message : 'Ingrese su contraseña actual.',
      })),
    });
  }

  const resultado = await solicitarApi('/auth/contrasena', {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error);
  }

  redirect('/mi-cuenta');
}
