'use server';

import {
  esquemaAltaTrabajador,
  esquemaCeseTrabajador,
  esquemaFichaTrabajador,
  esquemaReactivacionTrabajador,
  esquemaTrabajadorDetalle,
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
  leerLista,
  leerOpcional,
  leerTexto,
  valoresDeFormulario,
} from '@/lib/form-state';

const ERROR_TRABAJADOR = estadoConError({ mensaje: 'Trabajador no válido.', errores: [] });

function leerFicha(datos: FormData): Record<string, string | null> {
  return {
    nombres: leerTexto(datos, 'nombres'),
    apellidos: leerTexto(datos, 'apellidos'),
    dni: leerTexto(datos, 'dni'),
    cargoId: leerTexto(datos, 'cargoId'),
    areaId: leerTexto(datos, 'areaId'),
    tipoVinculoId: leerTexto(datos, 'tipoVinculoId'),
    fechaIncorporacion: leerTexto(datos, 'fechaIncorporacion'),
    horario: leerTexto(datos, 'horario'),
    telefono: leerTexto(datos, 'telefono'),
    funciones: leerTexto(datos, 'funciones'),
    supervisorId: leerOpcional(datos, 'supervisorId'),
  };
}

function leerCuenta(datos: FormData): Record<string, unknown> {
  return leerTexto(datos, 'tipoCuenta') === 'EXISTENTE'
    ? { tipo: 'EXISTENTE', usuarioId: leerTexto(datos, 'usuarioId') }
    : {
        tipo: 'NUEVA',
        correo: leerTexto(datos, 'correo'),
        contrasena: leerTexto(datos, 'contrasena'),
        rolIds: leerLista(datos, 'rolIds'),
      };
}

export async function crearTrabajador(_anterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDeFormulario(datos);
  const entrada = esquemaAltaTrabajador.safeParse({ ...leerFicha(datos), cuenta: leerCuenta(datos) });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi('/personal', {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: esquemaTrabajadorDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath('/personal');
  redirect(`/personal/${resultado.datos.id}`);
}

export async function editarTrabajador(
  id: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(id).success) {
    return ERROR_TRABAJADOR;
  }

  const valores = valoresDeFormulario(datos);
  const entrada = esquemaFichaTrabajador.safeParse(leerFicha(datos));

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/personal/${id}`, {
    metodo: 'PUT',
    cuerpo: entrada.data,
    esquema: esquemaTrabajadorDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath('/personal', 'layout');
  return estadoExitoso('Ficha actualizada.');
}

export async function cesarTrabajador(
  id: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(id).success) {
    return ERROR_TRABAJADOR;
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

  const entrada = esquemaCeseTrabajador.safeParse({
    fechaCese: leerTexto(datos, 'fechaCese'),
    motivo: leerTexto(datos, 'motivo'),
    reasignarAId: leerOpcional(datos, 'reasignarAId'),
  });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/personal/${id}/cese`, {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: esquemaTrabajadorDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath('/personal', 'layout');
  return estadoExitoso(
    'Baja registrada. Su acceso y sus asignaciones a clientes quedaron retirados y sus tareas abiertas fueron reasignadas.',
  );
}

export async function reactivarTrabajador(
  id: string,
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  if (!z.uuid().safeParse(id).success) {
    return ERROR_TRABAJADOR;
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

  const entrada = esquemaReactivacionTrabajador.safeParse({ motivo: leerTexto(datos, 'motivo') });

  if (!entrada.success) {
    return estadoDesdeProblemas(entrada.error.issues, valores);
  }

  const resultado = await solicitarApi(`/personal/${id}/reactivacion`, {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: esquemaTrabajadorDetalle,
  });

  if (!resultado.ok) {
    return estadoConError(resultado.error, valores);
  }

  revalidatePath('/personal', 'layout');
  return estadoExitoso('Trabajador reactivado. Asígnele nuevamente sus clientes si corresponde.');
}
