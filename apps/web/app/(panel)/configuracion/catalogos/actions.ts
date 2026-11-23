'use server';

import { esquemaNombreCatalogo, esquemaTipoCatalogo, type TipoCatalogo } from '@sige/types';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { solicitarApi } from '@/lib/api';
import {
  type EstadoFormulario,
  estadoConError,
  estadoDesdeProblemas,
  estadoExitoso,
  leerTexto,
} from '@/lib/form-state';

const ERROR_ELEMENTO = estadoConError({ mensaje: 'Elemento no válido.', errores: [] });

function tipoValido(tipo: string): tipo is TipoCatalogo {
  return esquemaTipoCatalogo.safeParse(tipo).success;
}

export async function crearElemento(
  tipo: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!tipoValido(tipo)) {
    return ERROR_ELEMENTO;
  }

  const valores = { nombre: leerTexto(datos, 'nombre') };
  const entrada = esquemaNombreCatalogo.safeParse(valores);

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/catalogos/${tipo}`, {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath('/configuracion/catalogos');
  return estadoExitoso(`"${entrada.data.nombre}" agregado.`);
}

export async function renombrarElemento(
  tipo: string,
  id: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!tipoValido(tipo) || !z.uuid().safeParse(id).success) {
    return ERROR_ELEMENTO;
  }

  const valores = { nombre: leerTexto(datos, 'nombre') };
  const entrada = esquemaNombreCatalogo.safeParse(valores);

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/catalogos/${tipo}/${id}`, {
    metodo: 'PUT',
    cuerpo: entrada.data,
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath('/configuracion/catalogos');
  return estadoExitoso('Nombre actualizado.');
}

export async function cambiarEstadoElemento(
  tipo: string,
  id: string,
  activar: boolean,
): Promise<EstadoFormulario> {
  if (!tipoValido(tipo) || !z.uuid().safeParse(id).success) {
    return ERROR_ELEMENTO;
  }

  const resultado = await solicitarApi(`/catalogos/${tipo}/${id}/${activar ? 'activacion' : 'desactivacion'}`, {
    metodo: 'POST',
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error);
  }

  revalidatePath('/configuracion/catalogos');
  return estadoExitoso(activar ? 'Activado.' : 'Desactivado.');
}
