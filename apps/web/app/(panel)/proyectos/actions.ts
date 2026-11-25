'use server';

import {
  esquemaCambioEstadoProyecto,
  esquemaDificultadEntrada,
  esquemaEntregableEntrada,
  esquemaEtapaEntrada,
  esquemaOrdenEtapa,
  esquemaProyectoDetalle,
  esquemaProyectoEntrada,
  esquemaRevisionEntregable,
  TAMANO_MAXIMO_ENTREGABLE_MB,
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
  leerTexto,
  valoresDeFormulario,
} from '@/lib/form-state';

const ERROR_IDENTIFICADOR = estadoConError({ mensaje: 'Registro no válido.', errores: [] });

function idsValidos(...ids: string[]): boolean {
  return ids.every((id) => z.uuid().safeParse(id).success);
}

function leerProyecto(datos: FormData): Record<string, unknown> {
  return {
    nombre: leerTexto(datos, 'nombre'),
    clienteId: leerTexto(datos, 'clienteId'),
    servicioId: leerTexto(datos, 'servicioId'),
    descripcion: leerTexto(datos, 'descripcion'),
    objetivo: leerTexto(datos, 'objetivo'),
    responsableId: leerTexto(datos, 'responsableId'),
    miembroIds: leerLista(datos, 'miembroIds'),
    presupuesto: leerTexto(datos, 'presupuesto'),
    honorarios: leerTexto(datos, 'honorarios'),
    fechaInicio: leerTexto(datos, 'fechaInicio'),
    fechaEntrega: leerTexto(datos, 'fechaEntrega'),
  };
}

function revalidar(id: string): void {
  revalidatePath('/proyectos');
  revalidatePath(`/proyectos/${id}`);
  revalidatePath('/inicio');
}

async function enviar(
  ruta: string,
  metodo: 'POST' | 'PUT',
  cuerpo: unknown,
  valores: Partial<Record<string, string>>,
  proyectoId: string,
  mensaje: string,
): Promise<EstadoFormulario> {
  const resultado = await solicitarApi(ruta, { metodo, cuerpo, esquema: z.null() });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidar(proyectoId);
  return estadoExitoso(mensaje);
}

export async function crearProyecto(_anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDeFormulario(datos);
  const entrada = esquemaProyectoEntrada.safeParse(leerProyecto(datos));

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi('/proyectos', { metodo: 'POST', cuerpo: entrada.data, esquema: esquemaProyectoDetalle });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath('/proyectos');
  redirect(`/proyectos/${resultado.datos.id}`);
}

export async function editarProyecto(id: string, _anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  if (!idsValidos(id)) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaProyectoEntrada.safeParse(leerProyecto(datos));

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  return enviar(`/proyectos/${id}`, 'PUT', entrada.data, valores, id, 'Proyecto actualizado.');
}

export async function cambiarEstadoProyecto(id: string, _anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  if (!idsValidos(id)) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaCambioEstadoProyecto.safeParse({
    estado: leerTexto(datos, 'estado'),
    comentario: leerTexto(datos, 'comentario'),
  });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  return enviar(`/proyectos/${id}/estado`, 'POST', entrada.data, valores, id, 'Estado actualizado.');
}

export async function reportarDificultad(id: string, _anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  if (!idsValidos(id)) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaDificultadEntrada.safeParse({
    conDificultades: leerCasilla(datos, 'conDificultades'),
    detalle: leerTexto(datos, 'detalle'),
  });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  return enviar(
    `/proyectos/${id}/dificultad`,
    'POST',
    entrada.data,
    valores,
    id,
    entrada.data.conDificultades ? 'Dificultad reportada.' : 'Dificultad marcada como resuelta.',
  );
}

export async function guardarEtapa(
  proyectoId: string,
  etapaId: string | null,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!idsValidos(proyectoId) || (etapaId !== null && !idsValidos(etapaId))) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaEtapaEntrada.safeParse({
    nombre: leerTexto(datos, 'nombre'),
    inicio: leerTexto(datos, 'inicio'),
    fin: leerTexto(datos, 'fin'),
    estado: leerTexto(datos, 'estado') || 'PENDIENTE',
  });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  return enviar(
    etapaId === null ? `/proyectos/${proyectoId}/etapas` : `/proyectos/${proyectoId}/etapas/${etapaId}`,
    etapaId === null ? 'POST' : 'PUT',
    entrada.data,
    valores,
    proyectoId,
    etapaId === null ? 'Etapa agregada.' : 'Etapa actualizada.',
  );
}

export async function moverEtapa(
  proyectoId: string,
  etapaId: string,
  direccion: 'subir' | 'bajar',
): Promise<EstadoFormulario> {
  if (!idsValidos(proyectoId, etapaId) || !esquemaOrdenEtapa.safeParse({ direccion }).success) {
    return ERROR_IDENTIFICADOR;
  }

  return enviar(`/proyectos/${proyectoId}/etapas/${etapaId}/orden`, 'POST', { direccion }, {}, proyectoId, 'Orden actualizado.');
}

export async function crearEntregable(
  proyectoId: string,
  etapaId: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!idsValidos(proyectoId, etapaId)) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaEntregableEntrada.safeParse({
    nombre: leerTexto(datos, 'nombre'),
    fechaCompromiso: leerTexto(datos, 'fechaCompromiso'),
  });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  return enviar(`/proyectos/${proyectoId}/etapas/${etapaId}/entregables`, 'POST', entrada.data, valores, proyectoId, 'Entregable agregado.');
}

export async function entregarArchivo(
  proyectoId: string,
  entregableId: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!idsValidos(proyectoId, entregableId)) {
    return ERROR_IDENTIFICADOR;
  }

  const archivo = datos.get('archivo');

  if (!(archivo instanceof File) || archivo.size === 0) {
    return estadoConError({ mensaje: 'Adjunte el archivo.', errores: [{ campo: 'archivo', mensaje: 'Seleccione un archivo.' }] });
  }

  if (archivo.size > TAMANO_MAXIMO_ENTREGABLE_MB * 1024 * 1024) {
    return estadoConError({
      mensaje: 'El archivo es demasiado grande.',
      errores: [{ campo: 'archivo', mensaje: `Máximo ${String(TAMANO_MAXIMO_ENTREGABLE_MB)} MB.` }],
    });
  }

  const formulario = new FormData();
  formulario.append('archivo', archivo, archivo.name);
  const resultado = await solicitarApi(`/proyectos/${proyectoId}/entregables/${entregableId}/entrega`, {
    metodo: 'POST',
    formulario,
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error);
  }

  revalidar(proyectoId);
  return estadoExitoso('Entregable enviado para aprobación.');
}

export async function revisarEntregable(
  proyectoId: string,
  entregableId: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!idsValidos(proyectoId, entregableId)) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaRevisionEntregable.safeParse({
    decision: leerTexto(datos, 'decision'),
    comentario: leerTexto(datos, 'comentario'),
  });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  return enviar(
    `/proyectos/${proyectoId}/entregables/${entregableId}/revision`,
    'POST',
    entrada.data,
    valores,
    proyectoId,
    entrada.data.decision === 'APROBAR' ? 'Entregable aprobado.' : 'Entregable observado.',
  );
}
