'use server';

import {
  esquemaCarpetaEntrada,
  esquemaDocumentoDetalle,
  esquemaDocumentoEntrada,
  esquemaDocumentoEsperadoEntrada,
  esquemaEdicionDocumento,
  esquemaMotivo,
  esquemaTipoDocumentoEntrada,
  esquemaVersionEntrada,
  TAMANO_MAXIMO_DOCUMENTO_MB,
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
  leerTexto,
  valoresDeFormulario,
} from '@/lib/form-state';

const ERROR_IDENTIFICADOR = estadoConError({ mensaje: 'Registro no válido.', errores: [] });

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

function revalidarDocumentos(clienteId: string | null): void {
  revalidatePath('/documentos', 'layout');
  revalidatePath('/inicio');

  if (clienteId !== null) {
    revalidatePath(`/clientes/${clienteId}/documentos`);
  }
}

function leerArchivo(datos: FormData, valores: Partial<Record<string, string>>): File | EstadoFormulario {
  const archivo = datos.get('archivo');

  if (!(archivo instanceof File) || archivo.size === 0) {
    return estadoConError(
      { mensaje: 'Adjunte el archivo del documento.', errores: [{ campo: 'archivo', mensaje: 'Seleccione un archivo.' }] },
      valores,
    );
  }

  if (archivo.size > TAMANO_MAXIMO_DOCUMENTO_MB * 1024 * 1024) {
    return estadoConError(
      {
        mensaje: 'El archivo es demasiado grande.',
        errores: [{ campo: 'archivo', mensaje: `Máximo ${String(TAMANO_MAXIMO_DOCUMENTO_MB)} MB.` }],
      },
      valores,
    );
  }

  return archivo;
}

const CAMPOS_CLASIFICACION = [
  'titulo',
  'tipoDocumentoId',
  'carpetaId',
  'areaId',
  'periodo',
  'fechaDocumento',
  'fechaVencimiento',
  'confidencialidad',
] as const;

function leerClasificacion(datos: FormData): Record<string, string> {
  const campos = Object.fromEntries(CAMPOS_CLASIFICACION.map((campo) => [campo, leerTexto(datos, campo)]));
  return { ...campos, confidencialidad: campos.confidencialidad === '' ? 'NORMAL' : (campos.confidencialidad ?? 'NORMAL') };
}

export async function subirDocumento(
  clienteFijo: string | null,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (clienteFijo !== null && !idsValidos(clienteFijo)) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const campos = {
    ...leerClasificacion(datos),
    clienteId: clienteFijo ?? leerTexto(datos, 'clienteId'),
    nota: leerTexto(datos, 'nota'),
  };
  const entrada = esquemaDocumentoEntrada.safeParse(campos);

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const archivo = leerArchivo(datos, valores);

  if (!(archivo instanceof File)) {
    return archivo;
  }

  const formulario = new FormData();

  for (const [clave, valor] of Object.entries(campos)) {
    formulario.set(clave, valor);
  }

  formulario.append('archivo', archivo, archivo.name);

  const resultado = await solicitarApi('/documentos', {
    metodo: 'POST',
    formulario,
    esquema: esquemaDocumentoDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarDocumentos(resultado.datos.cliente?.id ?? null);

  if (clienteFijo === null) {
    redirect(`/documentos/${resultado.datos.id}`);
  }

  return estadoExitoso(`Documento «${resultado.datos.titulo}» subido.`);
}

export async function subirVersion(id: string, _anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  if (!idsValidos(id)) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const nota = leerTexto(datos, 'nota');
  const entrada = esquemaVersionEntrada.safeParse({ nota });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const archivo = leerArchivo(datos, valores);

  if (!(archivo instanceof File)) {
    return archivo;
  }

  const formulario = new FormData();
  formulario.set('nota', nota);
  formulario.append('archivo', archivo, archivo.name);

  const resultado = await solicitarApi(`/documentos/${id}/versiones`, {
    metodo: 'POST',
    formulario,
    esquema: esquemaDocumentoDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarDocumentos(resultado.datos.cliente?.id ?? null);
  return estadoExitoso(`Versión ${String(resultado.datos.versionActual)} subida. Las anteriores se conservan.`);
}

export async function editarDocumento(id: string, _anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  if (!idsValidos(id)) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaEdicionDocumento.safeParse(leerClasificacion(datos));

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/documentos/${id}`, {
    metodo: 'PUT',
    cuerpo: entrada.data,
    esquema: esquemaDocumentoDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarDocumentos(resultado.datos.cliente?.id ?? null);
  return estadoExitoso('Datos del documento actualizados.');
}

export async function archivarDocumento(
  id: string,
  clienteId: string | null,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!idsValidos(id)) {
    return ERROR_IDENTIFICADOR;
  }

  const sinConfirmar = confirmado(datos);

  if (sinConfirmar !== null) {
    return sinConfirmar;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaMotivo.safeParse({ motivo: leerTexto(datos, 'motivo') });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/documentos/${id}/archivo`, {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarDocumentos(clienteId);
  return estadoExitoso('Documento archivado. Se conserva con todas sus versiones y ya no aparece en las vistas normales.');
}

export async function crearCarpeta(clienteId: string, _anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  if (!idsValidos(clienteId)) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaCarpetaEntrada.safeParse({ nombre: leerTexto(datos, 'nombre'), padreId: leerTexto(datos, 'padreId') });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/documentos/clientes/${clienteId}/carpetas`, {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarDocumentos(clienteId);
  return estadoExitoso(`Carpeta «${entrada.data.nombre}» creada.`);
}

export async function renombrarCarpeta(
  clienteId: string,
  carpetaId: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!idsValidos(clienteId, carpetaId)) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaCarpetaEntrada.pick({ nombre: true }).safeParse({ nombre: leerTexto(datos, 'nombre') });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/documentos/clientes/${clienteId}/carpetas/${carpetaId}`, {
    metodo: 'PUT',
    cuerpo: entrada.data,
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarDocumentos(clienteId);
  return estadoExitoso('Carpeta renombrada.');
}

export async function registrarEsperado(
  clienteId: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!idsValidos(clienteId)) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaDocumentoEsperadoEntrada.safeParse({
    tipoDocumentoId: leerTexto(datos, 'tipoDocumentoId'),
    periodo: leerTexto(datos, 'periodo'),
    fechaLimite: leerTexto(datos, 'fechaLimite'),
    descripcion: leerTexto(datos, 'descripcion'),
  });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/documentos/clientes/${clienteId}/esperados`, {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarDocumentos(clienteId);
  return estadoExitoso('Documento esperado registrado. Se marcará como recibido al subir un documento de ese tipo y periodo.');
}

export async function anularEsperado(
  clienteId: string,
  esperadoId: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!idsValidos(clienteId, esperadoId)) {
    return ERROR_IDENTIFICADOR;
  }

  const sinConfirmar = confirmado(datos);

  if (sinConfirmar !== null) {
    return sinConfirmar;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaMotivo.safeParse({ motivo: leerTexto(datos, 'motivo') });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/documentos/clientes/${clienteId}/esperados/${esperadoId}/anulacion`, {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarDocumentos(clienteId);
  return estadoExitoso('Documento esperado anulado.');
}

export async function guardarTipoDocumento(
  id: string | null,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (id !== null && !idsValidos(id)) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaTipoDocumentoEntrada.safeParse({
    nombre: leerTexto(datos, 'nombre'),
    admiteVencimiento: leerCasilla(datos, 'admiteVencimiento'),
  });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(id === null ? '/documentos/tipos' : `/documentos/tipos/${id}`, {
    metodo: id === null ? 'POST' : 'PUT',
    cuerpo: entrada.data,
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath('/configuracion/tipos-documento');
  return estadoExitoso(id === null ? 'Tipo de documento creado.' : 'Tipo de documento actualizado.');
}

export async function cambiarActivoTipoDocumento(id: string, activo: boolean): Promise<EstadoFormulario> {
  if (!idsValidos(id)) {
    return ERROR_IDENTIFICADOR;
  }

  const resultado = await solicitarApi(`/documentos/tipos/${id}/activacion`, {
    metodo: 'POST',
    cuerpo: { activo },
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error);
  }

  revalidatePath('/configuracion/tipos-documento');
  return estadoExitoso(activo ? 'Tipo activado.' : 'Tipo desactivado.');
}
