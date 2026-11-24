'use server';

import {
  DIGITOS_RUC,
  esquemaCronogramaEntrada,
  esquemaGeneracionEntrada,
  esquemaGrupoClienteEntrada,
  esquemaMotivo,
  esquemaObligacionClienteEntrada,
  esquemaObligacionDetalle,
  esquemaPresentacionEntrada,
  esquemaResultadoGeneracion,
  esquemaTipoObligacionEntrada,
  ETIQUETAS_MOTIVO_OMISION,
  MOTIVOS_OMISION,
  TAMANO_MAXIMO_CONSTANCIA_MB,
} from '@sige/types';
import { revalidatePath } from 'next/cache';
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

function revalidarObligaciones(clienteId?: string): void {
  revalidatePath('/obligaciones', 'layout');
  revalidatePath('/inicio');
  revalidatePath('/tareas', 'layout');
  revalidatePath('/mi-trabajo');

  if (clienteId !== undefined) {
    revalidatePath(`/clientes/${clienteId}/obligaciones`);
  }
}

export async function presentarObligacion(
  id: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!idsValidos(id)) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const campos = {
    fechaPresentacion: leerTexto(datos, 'fechaPresentacion'),
    numeroOrden: leerTexto(datos, 'numeroOrden'),
    observaciones: leerTexto(datos, 'observaciones'),
  };
  const entrada = esquemaPresentacionEntrada.safeParse(campos);

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const constancia = datos.get('constancia');

  if (!(constancia instanceof File) || constancia.size === 0) {
    return estadoConError(
      {
        mensaje: 'Adjunte la constancia de presentación.',
        errores: [{ campo: 'constancia', mensaje: 'Seleccione la constancia en PDF o imagen.' }],
      },
      valores,
    );
  }

  if (constancia.size > TAMANO_MAXIMO_CONSTANCIA_MB * 1024 * 1024) {
    return estadoConError(
      {
        mensaje: 'La constancia es demasiado grande.',
        errores: [{ campo: 'constancia', mensaje: `Máximo ${String(TAMANO_MAXIMO_CONSTANCIA_MB)} MB.` }],
      },
      valores,
    );
  }

  const formulario = new FormData();

  for (const [clave, valor] of Object.entries(campos)) {
    formulario.set(clave, valor);
  }

  formulario.append('constancia', constancia, constancia.name);

  const resultado = await solicitarApi(`/obligaciones/${id}/presentacion`, {
    metodo: 'POST',
    formulario,
    esquema: esquemaObligacionDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarObligaciones(resultado.datos.cliente.id);
  revalidatePath(`/tareas/${resultado.datos.tareaId}`);
  return estadoExitoso(
    resultado.datos.estado === 'CUMPLIDA'
      ? 'Presentación registrada. La obligación quedó cumplida.'
      : 'Presentación registrada y enviada a revisión.',
  );
}

export async function generarObligaciones(_anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDeFormulario(datos);
  const entrada = esquemaGeneracionEntrada.safeParse({ periodo: leerTexto(datos, 'periodo') });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi('/obligaciones/generacion', {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: esquemaResultadoGeneracion,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarObligaciones();
  const { generadas, existentes, omitidas } = resultado.datos;
  const partes = [
    `${String(generadas)} ${generadas === 1 ? 'obligación generada' : 'obligaciones generadas'}`,
    `${String(existentes)} ya existían`,
  ];

  for (const motivo of MOTIVOS_OMISION) {
    const casos = omitidas.filter((omision) => omision.motivo === motivo);

    if (casos.length > 0) {
      const ejemplos = casos
        .slice(0, 3)
        .map((caso) => `${caso.cliente} (${caso.tipoObligacion})`)
        .join(', ');
      partes.push(
        `${String(casos.length)} sin generar: ${ETIQUETAS_MOTIVO_OMISION[motivo].toLowerCase()} — ${ejemplos}${casos.length > 3 ? '…' : ''}`,
      );
    }
  }

  const mensaje = `Periodo ${resultado.datos.periodo}: ${partes.join('. ')}.`;
  return omitidas.length === 0 ? estadoExitoso(mensaje) : estadoConError({ mensaje, errores: [] });
}

export async function cambiarGrupoCliente(
  clienteId: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!idsValidos(clienteId)) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaGrupoClienteEntrada.safeParse({ grupoCronograma: leerTexto(datos, 'grupoCronograma') });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/obligaciones/clientes/${clienteId}/grupo`, {
    metodo: 'PUT',
    cuerpo: entrada.data,
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarObligaciones(clienteId);
  return estadoExitoso('Grupo del cronograma actualizado. Se aplica a las próximas obligaciones que se generen.');
}

function leerObligacionCliente(datos: FormData): Record<string, string | null> {
  return {
    tipoObligacionId: leerTexto(datos, 'tipoObligacionId'),
    responsableId: leerTexto(datos, 'responsableId'),
    revisorId: leerOpcional(datos, 'revisorId'),
    desdePeriodo: leerTexto(datos, 'desdePeriodo'),
    hastaPeriodo: leerOpcional(datos, 'hastaPeriodo'),
  };
}

export async function guardarObligacionCliente(
  clienteId: string,
  obligacionId: string | null,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!idsValidos(clienteId) || (obligacionId !== null && !idsValidos(obligacionId))) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaObligacionClienteEntrada.safeParse(leerObligacionCliente(datos));

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(
    obligacionId === null
      ? `/obligaciones/clientes/${clienteId}`
      : `/obligaciones/clientes/${clienteId}/${obligacionId}`,
    { metodo: obligacionId === null ? 'POST' : 'PUT', cuerpo: entrada.data, esquema: z.null() },
  );

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarObligaciones(clienteId);
  return estadoExitoso(obligacionId === null ? 'Obligación configurada.' : 'Configuración actualizada.');
}

export async function desactivarObligacionCliente(
  clienteId: string,
  obligacionId: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!idsValidos(clienteId, obligacionId)) {
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

  const resultado = await solicitarApi(`/obligaciones/clientes/${clienteId}/${obligacionId}/desactivacion`, {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidarObligaciones(clienteId);
  return estadoExitoso('Obligación desactivada. Ya no se generará en los próximos periodos.');
}

export async function guardarTipoObligacion(
  id: string | null,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (id !== null && !idsValidos(id)) {
    return ERROR_IDENTIFICADOR;
  }

  const valores = valoresDeFormulario(datos);
  const usaCronograma = leerCasilla(datos, 'usaCronograma');
  const dia = leerOpcional(datos, 'diaVencimiento');
  const entrada = esquemaTipoObligacionEntrada.safeParse({
    codigo: leerTexto(datos, 'codigo'),
    nombre: leerTexto(datos, 'nombre'),
    descripcion: leerTexto(datos, 'descripcion'),
    usaCronograma,
    diaVencimiento: dia === null ? null : Number(dia),
    diasAlerta: leerLista(datos, 'diasAlerta')
      .flatMap((valor) => valor.split(','))
      .map((valor) => valor.trim())
      .filter((valor) => valor !== '')
      .map(Number),
  });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(id === null ? '/obligaciones/tipos' : `/obligaciones/tipos/${id}`, {
    metodo: id === null ? 'POST' : 'PUT',
    cuerpo: entrada.data,
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath('/configuracion/obligaciones');
  revalidarObligaciones();
  return estadoExitoso(id === null ? 'Tipo de obligación creado.' : 'Tipo de obligación actualizado.');
}

export async function cambiarActivoTipo(id: string, activo: boolean): Promise<EstadoFormulario> {
  if (!idsValidos(id)) {
    return ERROR_IDENTIFICADOR;
  }

  const resultado = await solicitarApi(`/obligaciones/tipos/${id}/activacion`, {
    metodo: 'POST',
    cuerpo: { activo },
    esquema: z.null(),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error);
  }

  revalidatePath('/configuracion/obligaciones');
  revalidarObligaciones();
  return estadoExitoso(activo ? 'Tipo activado.' : 'Tipo desactivado.');
}

export async function guardarCronograma(_anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDeFormulario(datos);
  const entrada = esquemaCronogramaEntrada.safeParse({
    tipoObligacionId: leerTexto(datos, 'tipoObligacionId'),
    periodo: leerTexto(datos, 'periodo'),
    grupo: leerTexto(datos, 'grupo'),
    fuente: leerTexto(datos, 'fuente'),
    fechas: DIGITOS_RUC.map((digito) => ({
      ultimoDigito: Number(digito),
      fechaVencimiento: leerTexto(datos, `digito${digito}`),
    })),
  });

  if (!entrada.success) {
    return estadoConError(
      {
        mensaje: 'Revise los datos ingresados.',
        errores: entrada.error.issues.map((problema) => {
          const [raiz, indice] = problema.path;
          return {
            campo: raiz === 'fechas' && typeof indice === 'number' ? `digito${String(indice)}` : String(raiz ?? ''),
            mensaje: problema.message,
          };
        }),
      },
      valores,
    );
  }

  const resultado = await solicitarApi('/obligaciones/cronograma', {
    metodo: 'PUT',
    cuerpo: entrada.data,
    esquema: z.object({ reprogramadas: z.number().int().nonnegative() }),
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath('/configuracion/cronograma');
  revalidarObligaciones();
  const { reprogramadas } = resultado.datos;
  return estadoExitoso(
    reprogramadas === 0
      ? `Cronograma ${entrada.data.periodo} guardado.`
      : `Cronograma ${entrada.data.periodo} guardado. Se reprogramaron ${String(reprogramadas)} obligaciones que seguían abiertas.`,
  );
}
