'use server';

import {
  esquemaAvanceEntrada,
  esquemaComentarioEntrada,
  esquemaEdicionTarea,
  esquemaTareaDetalle,
  esquemaTareaEntrada,
  MAXIMO_EVIDENCIAS_POR_AVANCE,
  TAMANO_MAXIMO_EVIDENCIA_MB,
} from '@sige/types';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { solicitarApi } from '@/lib/api';
import {
  type EstadoFormulario,
  estadoConError,
  estadoDesdeProblemas,
  estadoExitoso,
  leerCasilla,
  leerLista,
  leerOpcional,
  leerTexto,
  valoresDeFormulario,
} from '@/lib/form-state';

const ERROR_TAREA = estadoConError({ mensaje: 'Tarea no válida.', errores: [] });

function leerTarea(datos: FormData): Record<string, unknown> {
  return {
    titulo: leerTexto(datos, 'titulo'),
    instrucciones: leerTexto(datos, 'instrucciones'),
    clienteId: leerOpcional(datos, 'clienteId'),
    responsableId: leerTexto(datos, 'responsableId'),
    colaboradorIds: leerLista(datos, 'colaboradorIds'),
    revisorId: leerOpcional(datos, 'revisorId'),
    prioridad: leerTexto(datos, 'prioridad'),
    fechaInicio: leerTexto(datos, 'fechaInicio'),
    fechaLimite: leerTexto(datos, 'fechaLimite'),
    requiereAprobacion: leerCasilla(datos, 'requiereAprobacion'),
    requiereEvidencia: leerCasilla(datos, 'requiereEvidencia'),
    evidenciaRequerida: leerTexto(datos, 'evidenciaRequerida'),
  };
}

export async function crearTarea(_anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDeFormulario(datos);
  const entrada = esquemaTareaEntrada.safeParse(leerTarea(datos));

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi('/tareas', {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: esquemaTareaDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath('/tareas');
  revalidatePath('/mi-trabajo');
  redirect(`/tareas/${resultado.datos.id}`);
}

export async function editarTarea(
  id: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(id).success) {
    return ERROR_TAREA;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaEdicionTarea.safeParse({ ...leerTarea(datos), version: leerTexto(datos, 'version') });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/tareas/${id}`, {
    metodo: 'PUT',
    cuerpo: entrada.data,
    esquema: esquemaTareaDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath('/tareas', 'layout');
  revalidatePath('/mi-trabajo');
  redirect(`/tareas/${id}`);
}

export async function iniciarTarea(id: string): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(id).success) {
    return ERROR_TAREA;
  }

  const resultado = await solicitarApi(`/tareas/${id}/inicio`, { metodo: 'POST', esquema: esquemaTareaDetalle });

  if (!resultado.ok) {
    return estadoConError(resultado.error);
  }

  revalidatePath('/tareas', 'layout');
  revalidatePath('/mi-trabajo');
  return estadoExitoso('Tarea iniciada.');
}

export async function registrarAvance(
  id: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(id).success) {
    return ERROR_TAREA;
  }

  const valores = valoresDeFormulario(datos);
  const campos = {
    actividad: leerTexto(datos, 'actividad'),
    descripcion: leerTexto(datos, 'descripcion'),
    porcentaje: leerTexto(datos, 'porcentaje'),
    minutosDedicados: leerTexto(datos, 'minutosDedicados'),
    dificultades: leerTexto(datos, 'dificultades'),
    observaciones: leerTexto(datos, 'observaciones'),
    proximoPaso: leerTexto(datos, 'proximoPaso'),
    corrigeAId: leerTexto(datos, 'corrigeAId'),
  };
  const entrada = esquemaAvanceEntrada.safeParse(campos);

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const archivos = datos
    .getAll('evidencias')
    .filter((valor): valor is File => valor instanceof File && valor.size > 0);
  const totalBytes = archivos.reduce((suma, archivo) => suma + archivo.size, 0);

  if (archivos.length > MAXIMO_EVIDENCIAS_POR_AVANCE || totalBytes > TAMANO_MAXIMO_EVIDENCIA_MB * 1024 * 1024) {
    return estadoConError(
      {
        mensaje: 'Revise los archivos adjuntos.',
        errores: [
          {
            campo: 'evidencias',
            mensaje: `Adjunte hasta ${String(MAXIMO_EVIDENCIAS_POR_AVANCE)} archivos que sumen como máximo ${String(TAMANO_MAXIMO_EVIDENCIA_MB)} MB.`,
          },
        ],
      },
      valores,
    );
  }

  const formulario = new FormData();

  for (const [clave, valor] of Object.entries(campos)) {
    formulario.set(clave, valor);
  }

  for (const archivo of archivos) {
    formulario.append('evidencias', archivo, archivo.name);
  }

  const resultado = await solicitarApi(`/tareas/${id}/avances`, {
    metodo: 'POST',
    formulario,
    esquema: esquemaTareaDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath('/tareas', 'layout');
  revalidatePath('/mi-trabajo');
  return estadoExitoso(
    archivos.length === 0
      ? 'Avance registrado.'
      : `Avance registrado con ${String(archivos.length)} ${archivos.length === 1 ? 'evidencia' : 'evidencias'}.`,
  );
}

export async function comentarTarea(
  id: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(id).success) {
    return ERROR_TAREA;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaComentarioEntrada.safeParse({
    contenido: leerTexto(datos, 'contenido'),
    mencionadoIds: leerLista(datos, 'mencionadoIds'),
  });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/tareas/${id}/comentarios`, {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: esquemaTareaDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath(`/tareas/${id}`);
  return estadoExitoso('Comentario publicado.');
}
