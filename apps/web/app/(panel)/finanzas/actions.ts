'use server';

import {
  type CatalogoFinanciero,
  esquemaCatalogoFinanciero,
  esquemaCobroEntrada,
  esquemaComprobanteEntrada,
  esquemaContratoEntrada,
  esquemaEgresoEntrada,
  esquemaGeneracionHonorarios,
  esquemaIngresoDetalle,
  esquemaIngresoEntrada,
  esquemaMotivo,
  esquemaNombreSimple,
  esquemaProveedorEntrada,
  esquemaResultadoHonorarios,
  esquemaServicioContratadoEntrada,
  esquemaTipoServicio,
  TAMANO_MAXIMO_ADJUNTO_FINANZAS_MB,
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
  leerTexto,
  valoresDeFormulario,
} from '@/lib/form-state';
import { formatearPeriodo } from '@/lib/format';

const ERROR_IDENTIFICADOR = estadoConError({ mensaje: 'Registro no válido.', errores: [] });

function idsValidos(...ids: string[]): boolean {
  return ids.every((id) => z.uuid().safeParse(id).success);
}

function campos(datos: FormData, nombres: readonly string[]): Record<string, string> {
  return Object.fromEntries(nombres.map((nombre) => [nombre, leerTexto(datos, nombre)]));
}

function leerAdjunto(datos: FormData, campo: string, valores: Partial<Record<string, string>>): File | null | EstadoFormulario {
  const archivo = datos.get(campo);

  if (!(archivo instanceof File) || archivo.size === 0) {
    return null;
  }

  if (archivo.size > TAMANO_MAXIMO_ADJUNTO_FINANZAS_MB * 1024 * 1024) {
    return estadoConError(
      {
        mensaje: 'El archivo es demasiado grande.',
        errores: [{ campo, mensaje: `Máximo ${String(TAMANO_MAXIMO_ADJUNTO_FINANZAS_MB)} MB.` }],
      },
      valores,
    );
  }

  return archivo;
}

function multiparte(valores: Record<string, string>, campo: string, archivo: File | null): FormData {
  const formulario = new FormData();

  for (const [clave, valor] of Object.entries(valores)) {
    formulario.set(clave, valor);
  }

  if (archivo !== null) {
    formulario.append(campo, archivo, archivo.name);
  }

  return formulario;
}

function revalidarFinanzas(clienteId?: string): void {
  revalidatePath('/finanzas', 'layout');
  revalidatePath('/reportes/finanzas');

  if (clienteId !== undefined) {
    revalidatePath(`/clientes/${clienteId}/comercial`);
  }
}

const CAMPOS_CONTRATO = ['inicio', 'vencimiento', 'diaPago', 'condicionesPago', 'observaciones', 'documentoId'] as const;

export async function guardarContrato(clienteId: string, _anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  if (!idsValidos(clienteId)) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaContratoEntrada.safeParse(campos(datos, CAMPOS_CONTRATO));

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/clientes/${clienteId}/contrato`, { metodo: 'PUT', cuerpo: entrada.data, esquema: z.null() });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarFinanzas(clienteId);
  return estadoExitoso('Contrato guardado.');
}

const CAMPOS_SERVICIO = ['servicioId', 'honorario', 'periodicidad', 'desde', 'hasta', 'observaciones'] as const;

export async function guardarServicioContratado(
  clienteId: string,
  servicioContratadoId: string | null,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!idsValidos(clienteId) || (servicioContratadoId !== null && !idsValidos(servicioContratadoId))) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaServicioContratadoEntrada.safeParse(campos(datos, CAMPOS_SERVICIO));

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(
    servicioContratadoId === null
      ? `/clientes/${clienteId}/servicios`
      : `/clientes/${clienteId}/servicios/${servicioContratadoId}`,
    { metodo: servicioContratadoId === null ? 'POST' : 'PUT', cuerpo: entrada.data, esquema: z.null() },
  );

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarFinanzas(clienteId);
  return estadoExitoso(servicioContratadoId === null ? 'Servicio contratado registrado.' : 'Servicio actualizado.');
}

export async function darDeBajaServicio(
  clienteId: string,
  servicioContratadoId: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!idsValidos(clienteId, servicioContratadoId)) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaMotivo.safeParse({ motivo: leerTexto(datos, 'motivo') });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/clientes/${clienteId}/servicios/${servicioContratadoId}/baja`, {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarFinanzas(clienteId);
  return estadoExitoso('Servicio dado de baja.');
}

const CAMPOS_INGRESO = [
  'clienteId',
  'servicioContratadoId',
  'concepto',
  'periodo',
  'tipoComprobante',
  'serieNumero',
  'fechaEmision',
  'fechaVencimiento',
  'monto',
] as const;

export async function crearIngreso(_anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDeFormulario(datos);
  const entrada = esquemaIngresoEntrada.safeParse(campos(datos, CAMPOS_INGRESO));

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi('/finanzas/ingresos', { metodo: 'POST', cuerpo: entrada.data, esquema: esquemaIngresoDetalle });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarFinanzas(entrada.data.clienteId);
  redirect(`/finanzas/ingresos/${resultado.datos.id}`);
}

export async function generarHonorarios(_anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDeFormulario(datos);
  const entrada = esquemaGeneracionHonorarios.safeParse({ periodo: leerTexto(datos, 'periodo') });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi('/finanzas/ingresos/generacion', {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: esquemaResultadoHonorarios,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarFinanzas();
  const { generados, existentes } = resultado.datos;
  return estadoExitoso(
    `Honorarios de ${formatearPeriodo(entrada.data.periodo)}: ${String(generados)} generados, ${String(existentes)} ya existían.`,
  );
}

export async function registrarComprobante(ingresoId: string, _anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  if (!idsValidos(ingresoId)) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaComprobanteEntrada.safeParse(campos(datos, ['tipoComprobante', 'serieNumero', 'fechaEmision']));

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/finanzas/ingresos/${ingresoId}/comprobante`, {
    metodo: 'PUT',
    cuerpo: entrada.data,
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarFinanzas();
  return estadoExitoso('Comprobante registrado.');
}

const CAMPOS_COBRO = ['fecha', 'importe', 'medioPagoId', 'operacion'] as const;

export async function registrarCobro(ingresoId: string, _anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  if (!idsValidos(ingresoId)) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const crudos = campos(datos, CAMPOS_COBRO);
  const entrada = esquemaCobroEntrada.safeParse(crudos);

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const voucher = leerAdjunto(datos, 'voucher', valores);

  if (voucher !== null && !(voucher instanceof File)) {
    return voucher;
  }

  const resultado = await solicitarApi(`/finanzas/ingresos/${ingresoId}/cobros`, {
    metodo: 'POST',
    formulario: multiparte(crudos, 'voucher', voucher),
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarFinanzas();
  return estadoExitoso('Cobro registrado. El saldo se actualizó.');
}

async function anular(ruta: string, datos: FormData, mensaje: string): Promise<EstadoFormulario> {
  const valores = valoresDeFormulario(datos);

  if (leerTexto(datos, 'confirmacion') !== 'si') {
    return estadoConError(
      { mensaje: 'Confirme la acción para continuar.', errores: [{ campo: 'confirmacion', mensaje: 'Marque la casilla de confirmación.' }] },
      valores,
    );
  }

  const entrada = esquemaMotivo.safeParse({ motivo: leerTexto(datos, 'motivo') });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(ruta, { metodo: 'POST', cuerpo: entrada.data, esquema: z.null() });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarFinanzas();
  return estadoExitoso(mensaje);
}

export async function anularIngreso(ingresoId: string, _anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  return idsValidos(ingresoId)
    ? anular(`/finanzas/ingresos/${ingresoId}/anulacion`, datos, 'Ingreso anulado.')
    : ERROR_IDENTIFICADOR;
}

export async function anularCobro(
  ingresoId: string,
  cobroId: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  return idsValidos(ingresoId, cobroId)
    ? anular(`/finanzas/ingresos/${ingresoId}/cobros/${cobroId}/anulacion`, datos, 'Cobro anulado. El saldo se repuso.')
    : ERROR_IDENTIFICADOR;
}

export async function anularEgreso(egresoId: string, _anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  return idsValidos(egresoId) ? anular(`/finanzas/egresos/${egresoId}/anulacion`, datos, 'Egreso anulado.') : ERROR_IDENTIFICADOR;
}

const CAMPOS_EGRESO = [
  'concepto',
  'proveedorId',
  'fecha',
  'importe',
  'categoriaId',
  'tipoComprobante',
  'serieNumero',
  'responsableId',
  'medioPagoId',
  'clienteId',
  'observaciones',
] as const;

export async function crearEgreso(_anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDeFormulario(datos);
  const crudos = campos(datos, CAMPOS_EGRESO);
  const entrada = esquemaEgresoEntrada.safeParse(crudos);

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const comprobante = leerAdjunto(datos, 'comprobante', valores);

  if (comprobante !== null && !(comprobante instanceof File)) {
    return comprobante;
  }

  const resultado = await solicitarApi('/finanzas/egresos', {
    metodo: 'POST',
    formulario: multiparte(crudos, 'comprobante', comprobante),
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarFinanzas();
  return estadoExitoso('Egreso registrado.');
}

export async function guardarElementoCatalogo(
  catalogo: CatalogoFinanciero,
  id: string | null,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!esquemaCatalogoFinanciero.safeParse(catalogo).success || (id !== null && !idsValidos(id))) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const nombre = esquemaNombreSimple.safeParse({ nombre: leerTexto(datos, 'nombre') });
  const tipo = catalogo === 'servicios' ? esquemaTipoServicio.safeParse(leerTexto(datos, 'tipo')) : null;

  if (!nombre.success) {
    return estadoDesdeProblemas(nombre.error.issues, valores);
  }

  if (tipo !== null && !tipo.success) {
    return estadoConError(
      { mensaje: 'Revise los datos ingresados.', errores: [{ campo: 'tipo', mensaje: 'Seleccione el tipo de servicio.' }] },
      valores,
    );
  }

  const resultado = await solicitarApi(id === null ? `/finanzas/catalogos/${catalogo}` : `/finanzas/catalogos/${catalogo}/${id}`, {
    metodo: id === null ? 'POST' : 'PUT',
    cuerpo: { nombre: nombre.data.nombre, tipo: tipo?.data ?? null },
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath('/configuracion/finanzas');
  return estadoExitoso(id === null ? 'Elemento agregado.' : 'Elemento actualizado.');
}

export async function cambiarActivoCatalogo(
  catalogo: CatalogoFinanciero | 'proveedores',
  id: string,
  activo: boolean,
): Promise<EstadoFormulario> {
  if (!idsValidos(id) || (catalogo !== 'proveedores' && !esquemaCatalogoFinanciero.safeParse(catalogo).success)) {
    return ERROR_IDENTIFICADOR;
  }

  const resultado = await solicitarApi(
    catalogo === 'proveedores' ? `/finanzas/proveedores/${id}/activacion` : `/finanzas/catalogos/${catalogo}/${id}/activacion`,
    { metodo: 'POST', cuerpo: { activo }, esquema: z.null() },
  );

  if (!resultado.ok) {
    return estadoConError(resultado.error);
  }

  revalidatePath('/configuracion/finanzas');
  return estadoExitoso(activo ? 'Activado.' : 'Desactivado.');
}

export async function guardarProveedor(id: string | null, _anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  if (id !== null && !idsValidos(id)) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaProveedorEntrada.safeParse(campos(datos, ['razonSocial', 'ruc', 'contacto']));

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(id === null ? '/finanzas/proveedores' : `/finanzas/proveedores/${id}`, {
    metodo: id === null ? 'POST' : 'PUT',
    cuerpo: entrada.data,
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath('/configuracion/finanzas');
  revalidatePath('/finanzas/egresos');
  return estadoExitoso(id === null ? 'Proveedor registrado.' : 'Proveedor actualizado.');
}
