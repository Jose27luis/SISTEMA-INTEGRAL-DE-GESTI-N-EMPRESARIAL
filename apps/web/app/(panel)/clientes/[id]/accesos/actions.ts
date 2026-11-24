'use server';

import { esquemaAccesoEntrada } from '@sige/types';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { solicitarApi } from '@/lib/api';
import {
  type EstadoFormulario,
  estadoConError,
  estadoDesdeProblemas,
  estadoExitoso,
  leerCasilla,
  leerTexto,
  valoresDeFormulario,
} from '@/lib/form-state';

export async function guardarAcceso(
  clienteId: string,
  accesoId: string | null,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(clienteId).success || (accesoId !== null && !z.uuid().safeParse(accesoId).success)) {
    return estadoConError({ mensaje: 'Registro no válido.', errores: [] });
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaAccesoEntrada.safeParse({
    plataformaId: leerTexto(datos, 'plataformaId'),
    url: leerTexto(datos, 'url'),
    identificador: leerTexto(datos, 'identificador'),
    responsableAutorizadoId: leerTexto(datos, 'responsableAutorizadoId'),
    fechaRevision: leerTexto(datos, 'fechaRevision'),
    estado: leerTexto(datos, 'estado'),
    tieneMfa: leerCasilla(datos, 'tieneMfa'),
    referenciaBoveda: leerTexto(datos, 'referenciaBoveda'),
    notas: leerTexto(datos, 'notas'),
  });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(
    accesoId === null ? `/accesos/clientes/${clienteId}` : `/accesos/clientes/${clienteId}/${accesoId}`,
    { metodo: accesoId === null ? 'POST' : 'PUT', cuerpo: entrada.data, esquema: z.null() },
  );

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath(`/clientes/${clienteId}/accesos`);
  return estadoExitoso(accesoId === null ? 'Acceso registrado.' : 'Acceso actualizado.');
}
