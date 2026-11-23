'use server';

import {
  esquemaAsignacionEntrada,
  esquemaCambioEstadoCliente,
  esquemaClienteDetalle,
  esquemaClienteEntrada,
  esquemaContactoEntrada,
  esquemaResultadoImportacion,
  type ResultadoImportacion,
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
  leerOpcional,
  leerTexto,
  valoresDeFormulario,
} from '@/lib/form-state';

const ERROR_CLIENTE = estadoConError({ mensaje: 'Cliente no válido.', errores: [] });

function idsValidos(...ids: string[]): boolean {
  return ids.every((id) => z.uuid().safeParse(id).success);
}

function confirmado(datos: FormData): EstadoFormulario | null {
  return leerTexto(datos, 'confirmacion') === 'si'
    ? null
    : estadoConError(
        {
          mensaje: 'Confirme la acción para continuar.',
          errores: [{ campo: 'confirmacion', mensaje: 'Marque la casilla de confirmación.' }],
        },
        valoresDeFormulario(datos),
      );
}

function leerCliente(datos: FormData): Record<string, string | null> {
  return {
    tipoPersona: leerTexto(datos, 'tipoPersona'),
    razonSocial: leerTexto(datos, 'razonSocial'),
    ruc: leerTexto(datos, 'ruc'),
    dni: leerTexto(datos, 'dni'),
    domicilioFiscal: leerTexto(datos, 'domicilioFiscal'),
    representanteLegal: leerTexto(datos, 'representanteLegal'),
    actividadEconomica: leerTexto(datos, 'actividadEconomica'),
    regimenTributarioId: leerOpcional(datos, 'regimenTributarioId'),
    fechaIncorporacion: leerTexto(datos, 'fechaIncorporacion'),
    responsableId: leerOpcional(datos, 'responsableId'),
  };
}

function leerContacto(datos: FormData): Record<string, string | boolean> {
  return {
    nombre: leerTexto(datos, 'nombre'),
    cargo: leerTexto(datos, 'cargo'),
    correo: leerTexto(datos, 'correo'),
    telefono: leerTexto(datos, 'telefono'),
    principal: leerCasilla(datos, 'principal'),
  };
}

function revalidarCliente(id: string): void {
  revalidatePath('/clientes');
  revalidatePath(`/clientes/${id}`, 'layout');
}

export async function crearCliente(_anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDeFormulario(datos);
  const entrada = esquemaClienteEntrada.safeParse(leerCliente(datos));

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi('/clientes', {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: esquemaClienteDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarCliente(resultado.datos.id);
  redirect(`/clientes/${resultado.datos.id}`);
}

export async function editarCliente(
  id: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!idsValidos(id)) {
    return ERROR_CLIENTE;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaClienteEntrada.safeParse(leerCliente(datos));

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/clientes/${id}`, {
    metodo: 'PUT',
    cuerpo: entrada.data,
    esquema: esquemaClienteDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarCliente(id);
  return estadoExitoso('Datos del cliente actualizados.');
}

export async function cambiarEstadoCliente(
  id: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!idsValidos(id)) {
    return ERROR_CLIENTE;
  }

  const sinConfirmar = confirmado(datos);

  if (sinConfirmar !== null) {
    return sinConfirmar;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaCambioEstadoCliente.safeParse({
    estado: leerTexto(datos, 'estado'),
    motivo: leerTexto(datos, 'motivo'),
  });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/clientes/${id}/estado`, {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: esquemaClienteDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarCliente(id);
  return estadoExitoso('Estado del cliente actualizado.');
}

export async function agregarContacto(
  id: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!idsValidos(id)) {
    return ERROR_CLIENTE;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaContactoEntrada.safeParse(leerContacto(datos));

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/clientes/${id}/contactos`, {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: esquemaClienteDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarCliente(id);
  return estadoExitoso('Contacto agregado.');
}

export async function editarContacto(
  id: string,
  contactoId: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!idsValidos(id, contactoId)) {
    return ERROR_CLIENTE;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaContactoEntrada.safeParse(leerContacto(datos));

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/clientes/${id}/contactos/${contactoId}`, {
    metodo: 'PUT',
    cuerpo: entrada.data,
    esquema: esquemaClienteDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarCliente(id);
  return estadoExitoso('Contacto actualizado.');
}

export async function desactivarContacto(
  id: string,
  contactoId: string,
): Promise<EstadoFormulario> {
  if (!idsValidos(id, contactoId)) {
    return ERROR_CLIENTE;
  }

  const resultado = await solicitarApi(`/clientes/${id}/contactos/${contactoId}/desactivacion`, {
    metodo: 'POST',
    esquema: esquemaClienteDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error);
  }

  revalidarCliente(id);
  return estadoExitoso('Contacto desactivado.');
}

export async function asignarUsuario(
  id: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!idsValidos(id)) {
    return ERROR_CLIENTE;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaAsignacionEntrada.safeParse({
    usuarioId: leerTexto(datos, 'usuarioId'),
    rolEnCliente: leerTexto(datos, 'rolEnCliente'),
  });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/clientes/${id}/asignaciones`, {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: esquemaClienteDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarCliente(id);
  return estadoExitoso('Equipo actualizado.');
}

export async function retirarAsignacion(
  id: string,
  asignacionId: string,
): Promise<EstadoFormulario> {
  if (!idsValidos(id, asignacionId)) {
    return ERROR_CLIENTE;
  }

  const resultado = await solicitarApi(`/clientes/${id}/asignaciones/${asignacionId}/retiro`, {
    metodo: 'POST',
    esquema: esquemaClienteDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error);
  }

  revalidarCliente(id);
  return estadoExitoso('Usuario retirado del cliente.');
}

export interface EstadoImportacion {
  mensaje: string | null;
  resultado: ResultadoImportacion | null;
}

export async function importarClientes(
  _anterior: EstadoImportacion,
  datos: FormData,
): Promise<EstadoImportacion> {
  const archivo = datos.get('archivo');

  if (!(archivo instanceof File) || archivo.size === 0) {
    return { mensaje: 'Seleccione el archivo Excel completado.', resultado: null };
  }

  const formulario = new FormData();
  formulario.set('archivo', archivo, archivo.name);

  const resultado = await solicitarApi('/clientes/importacion', {
    metodo: 'POST',
    formulario,
    esquema: esquemaResultadoImportacion,
  });

  if (!resultado.ok) {
    return { mensaje: resultado.error.mensaje, resultado: null };
  }

  revalidatePath('/clientes');
  return { mensaje: null, resultado: resultado.datos };
}
