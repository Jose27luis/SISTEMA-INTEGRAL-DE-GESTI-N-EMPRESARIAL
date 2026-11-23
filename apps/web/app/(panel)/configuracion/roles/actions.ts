'use server';

import { esquemaCreacionRol, esquemaEdicionRol, esquemaRolResumen } from '@sige/types';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { solicitarApi } from '@/lib/api';
import {
  type EstadoFormulario,
  estadoConError,
  estadoExitoso,
  leerLista,
  leerTexto,
} from '@/lib/form-state';

function leerRol(datos: FormData): Record<string, string> {
  return {
    codigo: leerTexto(datos, 'codigo'),
    nombre: leerTexto(datos, 'nombre'),
    descripcion: leerTexto(datos, 'descripcion'),
    alcance: leerTexto(datos, 'alcance'),
  };
}

function errorDeValidacion(
  problemas: z.core.$ZodIssue[],
  valores: Record<string, string>,
): EstadoFormulario {
  return estadoConError(
    {
      mensaje: 'Revise los datos del rol.',
      errores: problemas.map((problema) => ({
        campo: String(problema.path[0] ?? ''),
        mensaje: problema.message,
      })),
    },
    valores,
  );
}

export async function crearRol(_anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = leerRol(datos);
  const entrada = esquemaCreacionRol.safeParse({
    ...valores,
    descripcion: valores.descripcion === '' ? null : valores.descripcion,
    exigeMfa: datos.get('exigeMfa') === 'on',
    permisoIds: leerLista(datos, 'permisoIds'),
  });

  if (!entrada.success) {
    return errorDeValidacion(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi('/roles', {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: esquemaRolResumen,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath('/configuracion/roles');
  redirect(`/configuracion/roles/${resultado.datos.id}`);
}

export async function editarRol(
  rolId: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(rolId).success) {
    return estadoConError({ mensaje: 'Rol no válido.', errores: [] });
  }

  const valores = leerRol(datos);
  const entrada = esquemaEdicionRol.safeParse({
    nombre: valores.nombre,
    descripcion: valores.descripcion === '' ? null : valores.descripcion,
    exigeMfa: datos.get('exigeMfa') === 'on',
    permisoIds: leerLista(datos, 'permisoIds'),
  });

  if (!entrada.success) {
    return errorDeValidacion(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/roles/${rolId}`, {
    metodo: 'PUT',
    cuerpo: entrada.data,
    esquema: esquemaRolResumen,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath('/configuracion/roles', 'layout');
  return estadoExitoso('Rol actualizado. Los cambios aplican en la siguiente acción de cada usuario.');
}

export async function cambiarEstadoRol(
  rolId: string,
  activar: boolean,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(rolId).success) {
    return estadoConError({ mensaje: 'Rol no válido.', errores: [] });
  }

  if (leerTexto(datos, 'confirmacion') !== 'si') {
    return estadoConError({
      mensaje: 'Confirme la acción para continuar.',
      errores: [{ campo: 'confirmacion', mensaje: 'Marque la casilla de confirmación.' }],
    });
  }

  const resultado = await solicitarApi(`/roles/${rolId}/${activar ? 'activacion' : 'desactivacion'}`, {
    metodo: 'POST',
    esquema: esquemaRolResumen,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error);
  }

  revalidatePath('/configuracion/roles', 'layout');
  return estadoExitoso(activar ? 'Rol activado.' : 'Rol desactivado.');
}
