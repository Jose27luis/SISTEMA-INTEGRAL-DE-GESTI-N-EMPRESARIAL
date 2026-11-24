'use server';

import { esquemaCambioIncidencia, esquemaIncidenciaEntrada } from '@sige/types';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { solicitarApi } from '@/lib/api';
import {
  type EstadoFormulario,
  estadoConError,
  estadoDesdeProblemas,
  estadoExitoso,
  leerTexto,
  valoresDeFormulario,
} from '@/lib/form-state';

const ERROR_IDENTIFICADOR = estadoConError({ mensaje: 'Registro no válido.', errores: [] });

export async function registrarIncidencia(
  clienteId: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(clienteId).success) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaIncidenciaEntrada.safeParse({
    titulo: leerTexto(datos, 'titulo'),
    descripcion: leerTexto(datos, 'descripcion'),
    fecha: leerTexto(datos, 'fecha'),
    responsableId: leerTexto(datos, 'responsableId'),
  });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/clientes/${clienteId}/incidencias`, {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath(`/clientes/${clienteId}/operacion`);
  return estadoExitoso('Incidencia registrada. Se avisó al responsable.');
}

export async function cambiarEstadoIncidencia(
  clienteId: string,
  incidenciaId: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(clienteId).success || !z.uuid().safeParse(incidenciaId).success) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaCambioIncidencia.safeParse({
    estado: leerTexto(datos, 'estado'),
    comentario: leerTexto(datos, 'comentario'),
  });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/clientes/${clienteId}/incidencias/${incidenciaId}/estado`, {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath(`/clientes/${clienteId}/operacion`);
  return estadoExitoso('Estado de la incidencia actualizado.');
}
