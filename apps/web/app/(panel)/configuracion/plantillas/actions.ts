'use server';

import { esquemaPlantillaEntrada, esquemaReglaEntrada } from '@sige/types';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { solicitarApi } from '@/lib/api';
import {
  type EstadoFormulario,
  estadoConError,
  estadoDesdeProblemas,
  estadoExitoso,
  leerCasilla,
  leerOpcional,
  leerTexto,
  valoresDeFormulario,
} from '@/lib/form-state';

const ERROR_IDENTIFICADOR = estadoConError({ mensaje: 'Registro no válido.', errores: [] });

function numeroOpcional(datos: FormData, campo: string): number | null {
  const valor = leerOpcional(datos, campo);
  return valor === null ? null : Number(valor);
}

export async function guardarPlantilla(
  id: string | null,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (id !== null && !z.uuid().safeParse(id).success) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaPlantillaEntrada.safeParse({
    nombre: leerTexto(datos, 'nombre'),
    titulo: leerTexto(datos, 'titulo'),
    instrucciones: leerTexto(datos, 'instrucciones'),
    prioridad: leerTexto(datos, 'prioridad'),
    diasPlazo: Number(leerTexto(datos, 'diasPlazo') || '0'),
    requiereAprobacion: leerCasilla(datos, 'requiereAprobacion'),
    requiereEvidencia: leerCasilla(datos, 'requiereEvidencia'),
    evidenciaRequerida: leerTexto(datos, 'evidenciaRequerida'),
    items: leerTexto(datos, 'items')
      .split('\n')
      .map((linea) => linea.trim())
      .filter((linea) => linea !== ''),
  });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(id === null ? '/plantillas' : `/plantillas/${id}`, {
    metodo: id === null ? 'POST' : 'PUT',
    cuerpo: entrada.data,
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath('/configuracion/plantillas');
  revalidatePath('/tareas/nueva');
  return estadoExitoso(id === null ? 'Plantilla creada.' : 'Plantilla actualizada.');
}

export async function cambiarActivoPlantilla(id: string, activo: boolean): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(id).success) {
    return ERROR_IDENTIFICADOR;
  }

  const resultado = await solicitarApi(`/plantillas/${id}/activacion`, {
    metodo: 'POST',
    cuerpo: { activo },
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error);
  }

  revalidatePath('/configuracion/plantillas');
  revalidatePath('/tareas/recurrentes');
  return estadoExitoso(activo ? 'Plantilla activada.' : 'Plantilla desactivada junto con sus tareas recurrentes.');
}

export async function crearRegla(_anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDeFormulario(datos);
  const frecuencia = leerTexto(datos, 'frecuencia');
  const entrada = esquemaReglaEntrada.safeParse({
    plantillaId: leerTexto(datos, 'plantillaId'),
    clienteId: leerOpcional(datos, 'clienteId'),
    responsableId: leerTexto(datos, 'responsableId'),
    revisorId: leerOpcional(datos, 'revisorId'),
    frecuencia,
    diaDelMes: frecuencia === 'MENSUAL' ? numeroOpcional(datos, 'diaDelMes') : null,
    diaDeSemana: frecuencia === 'SEMANAL' ? numeroOpcional(datos, 'diaDeSemana') : null,
    vigenteDesde: leerTexto(datos, 'vigenteDesde'),
    vigenteHasta: leerOpcional(datos, 'vigenteHasta'),
  });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi('/tareas-recurrentes', {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath('/tareas/recurrentes');
  return estadoExitoso('Tarea recurrente creada. Las tareas se generan cada día a las 05:30.');
}

export async function cambiarActivoRegla(id: string, activo: boolean): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(id).success) {
    return ERROR_IDENTIFICADOR;
  }

  const resultado = await solicitarApi(`/tareas-recurrentes/${id}/activacion`, {
    metodo: 'POST',
    cuerpo: { activo },
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error);
  }

  revalidatePath('/tareas/recurrentes');
  return estadoExitoso(activo ? 'Tarea recurrente activada.' : 'Tarea recurrente pausada.');
}
