'use server';

import {
  esquemaAsignacionMasiva,
  esquemaAvanceEntrada,
  esquemaCancelacionEntrada,
  esquemaComentarioEntrada,
  esquemaEdicionTarea,
  esquemaEnvioEntrada,
  esquemaFinalizacionEntrada,
  esquemaItemEntrada,
  esquemaProrrogaEntrada,
  esquemaResolucionProrroga,
  esquemaResultadoAsignacionMasiva,
  esquemaRevisionEntrada,
  esquemaTareaDetalle,
  esquemaTareaEntrada,
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
    horaInicio: leerTexto(datos, 'horaInicio'),
    fechaLimite: leerTexto(datos, 'fechaLimite'),
    horaLimite: leerTexto(datos, 'horaLimite'),
    requiereAprobacion: leerCasilla(datos, 'requiereAprobacion'),
    requiereEvidencia: leerCasilla(datos, 'requiereEvidencia'),
    evidenciaRequerida: leerTexto(datos, 'evidenciaRequerida'),
    plantillaId: leerOpcional(datos, 'plantillaId'),
    etapaId: leerOpcional(datos, 'etapaId'),
    items: leerTexto(datos, 'items')
      .split('\n')
      .map((linea) => linea.trim())
      .filter((linea) => linea !== ''),
  };
}

export async function agregarItem(id: string, _anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(id).success) {
    return ERROR_TAREA;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaItemEntrada.safeParse({ texto: leerTexto(datos, 'texto') });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/tareas/${id}/items`, {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: esquemaTareaDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath(`/tareas/${id}`);
  return estadoExitoso('Ítem agregado.');
}

export async function marcarItem(
  id: string,
  itemId: string,
  completado: boolean,
): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(itemId).success) {
    return ERROR_TAREA;
  }

  const resultado = await solicitarApi(`/tareas/${id}/items/${itemId}`, {
    metodo: 'POST',
    cuerpo: { completado },
    esquema: esquemaTareaDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error);
  }

  revalidatePath(`/tareas/${id}`);
  return estadoExitoso(completado ? 'Ítem completado.' : 'Ítem reabierto.');
}

export async function crearTarea(_anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDeFormulario(datos);
  const responsableIds = leerLista(datos, 'responsableIds');
  const base = { ...leerTarea(datos), items: leerLista(datos, 'items'), subidaIds: leerLista(datos, 'subidaIds') };

  if (responsableIds.length > 1) {
    const masiva = esquemaAsignacionMasiva.safeParse({ ...base, responsableIds });

    if (!masiva.success) {
      return estadoDesdeProblemas(masiva.error.issues, valores);
    }

    const lote = await solicitarApi('/tareas/lote', {
      metodo: 'POST',
      cuerpo: masiva.data,
      esquema: esquemaResultadoAsignacionMasiva,
    });

    if (!lote.ok) {
      return estadoConError(lote.error, valores);
    }

    revalidatePath('/tareas');
    revalidatePath('/mi-trabajo');
    redirect(`/tareas?asignadas=${String(lote.datos.tareas.length)}`);
  }

  const entrada = esquemaTareaEntrada.safeParse({ ...base, responsableId: responsableIds[0] ?? '' });

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
    subidaIds: leerLista(datos, 'subidaIds'),
  };
  const entrada = esquemaAvanceEntrada.safeParse(campos);

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const formulario = new FormData();

  for (const [clave, valor] of Object.entries(campos)) {
    if (typeof valor === 'string') {
      formulario.set(clave, valor);
    }
  }

  for (const subidaId of entrada.data.subidaIds) {
    formulario.append('subidaIds', subidaId);
  }

  const resultado = await solicitarApi(`/tareas/${id}/avances`, {
    metodo: 'POST',
    formulario,
    esquema: esquemaTareaDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  const adjuntos = entrada.data.subidaIds.length;
  revalidatePath('/tareas', 'layout');
  revalidatePath('/mi-trabajo');
  return estadoExitoso(
    adjuntos === 0
      ? 'Avance registrado.'
      : `Avance registrado con ${String(adjuntos)} ${adjuntos === 1 ? 'evidencia' : 'evidencias'}.`,
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

async function ejecutarTransicion(
  id: string,
  ruta: string,
  cuerpo: unknown,
  valores: Partial<Record<string, string>>,
  mensaje: string,
): Promise<EstadoFormulario> {
  const resultado = await solicitarApi(`/tareas/${id}/${ruta}`, {
    metodo: 'POST',
    cuerpo,
    esquema: esquemaTareaDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath('/tareas', 'layout');
  revalidatePath('/mi-trabajo');
  revalidatePath('/por-revisar');
  return estadoExitoso(mensaje);
}

export async function enviarTarea(
  id: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(id).success) {
    return ERROR_TAREA;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaEnvioEntrada.safeParse({ comentario: leerTexto(datos, 'comentario') });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  return ejecutarTransicion(id, 'envio', entrada.data, valores, 'Trabajo enviado.');
}

export async function revisarTarea(
  id: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(id).success) {
    return ERROR_TAREA;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaRevisionEntrada.safeParse({
    decision: leerTexto(datos, 'decision'),
    comentario: leerTexto(datos, 'comentario'),
  });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  return ejecutarTransicion(
    id,
    'revision',
    entrada.data,
    valores,
    entrada.data.decision === 'APROBADA' ? 'Trabajo aprobado.' : 'Trabajo observado: se devolvió al responsable.',
  );
}

export async function finalizarTarea(
  id: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(id).success) {
    return ERROR_TAREA;
  }

  const valores = valoresDeFormulario(datos);

  if (leerTexto(datos, 'confirmacion') !== 'si') {
    return estadoConError(
      {
        mensaje: 'Confirme la acción para continuar.',
        errores: [{ campo: 'confirmacion', mensaje: 'Marque la casilla de confirmación.' }],
      },
      valores,
    );
  }

  const entrada = esquemaFinalizacionEntrada.safeParse({ comentario: '' });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  return ejecutarTransicion(id, 'finalizacion', entrada.data, valores, 'Tarea finalizada.');
}

export async function cancelarTarea(
  id: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(id).success) {
    return ERROR_TAREA;
  }

  const valores = valoresDeFormulario(datos);

  if (leerTexto(datos, 'confirmacion') !== 'si') {
    return estadoConError(
      {
        mensaje: 'Confirme la acción para continuar.',
        errores: [{ campo: 'confirmacion', mensaje: 'Marque la casilla de confirmación.' }],
      },
      valores,
    );
  }

  const entrada = esquemaCancelacionEntrada.safeParse({ motivo: leerTexto(datos, 'motivo') });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  return ejecutarTransicion(id, 'cancelacion', entrada.data, valores, 'Tarea cancelada.');
}

export async function acusarTarea(id: string): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(id).success) {
    return ERROR_TAREA;
  }

  return ejecutarTransicion(id, 'acuse', undefined, {}, 'Recepción confirmada.');
}

export async function solicitarProrroga(
  id: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(id).success) {
    return ERROR_TAREA;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaProrrogaEntrada.safeParse({
    fechaPropuesta: leerTexto(datos, 'fechaPropuesta'),
    horaPropuesta: leerTexto(datos, 'horaPropuesta'),
    motivo: leerTexto(datos, 'motivo'),
  });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  return ejecutarTransicion(id, 'prorrogas', entrada.data, valores, 'Prórroga solicitada. Quien asignó la tarea recibió el aviso.');
}

export async function resolverProrroga(
  id: string,
  prorrogaId: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(prorrogaId).success) {
    return ERROR_TAREA;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaResolucionProrroga.safeParse({
    decision: leerTexto(datos, 'decision'),
    respuesta: leerTexto(datos, 'respuesta'),
  });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  return ejecutarTransicion(
    id,
    `prorrogas/${prorrogaId}/resolucion`,
    entrada.data,
    valores,
    entrada.data.decision === 'APROBAR' ? 'Prórroga aprobada: la fecha límite cambió.' : 'Prórroga rechazada.',
  );
}
