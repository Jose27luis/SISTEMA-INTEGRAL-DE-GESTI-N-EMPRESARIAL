'use server';

import {
  esquemaActivacionMfa,
  esquemaCodigosRecuperacion,
  esquemaConfiguracionMfa,
} from '@sige/types';
import { solicitarApi } from '@/lib/api';
import { leerTexto } from '@/lib/form-state';
import { ESTADO_INICIAL_MFA, type EstadoConfiguracionMfa } from './mfa-state';

export async function avanzarConfiguracionMfa(
  anterior: EstadoConfiguracionMfa,
  datos: FormData,
): Promise<EstadoConfiguracionMfa> {
  if (anterior.etapa === 'inicio' || anterior.configuracion === null) {
    const resultado = await solicitarApi('/auth/mfa/configuracion', {
      metodo: 'POST',
      esquema: esquemaConfiguracionMfa,
    });

    if (!resultado.ok) {
      return { ...anterior, mensaje: resultado.error.mensaje };
    }

    return { ...ESTADO_INICIAL_MFA, etapa: 'escaneo', configuracion: resultado.datos };
  }

  const entrada = esquemaActivacionMfa.safeParse({ codigo: leerTexto(datos, 'codigo') });

  if (!entrada.success) {
    return { ...anterior, mensaje: null, errorCodigo: 'Ingrese los 6 dígitos que muestra la aplicación.' };
  }

  const resultado = await solicitarApi('/auth/mfa/activacion', {
    metodo: 'POST',
    cuerpo: entrada.data,
    esquema: esquemaCodigosRecuperacion,
  });

  if (!resultado.ok) {
    return {
      ...anterior,
      mensaje: resultado.error.mensaje,
      errorCodigo: resultado.error.errores.find(({ campo }) => campo === 'codigo')?.mensaje ?? null,
    };
  }

  return { ...anterior, etapa: 'activada', codigos: resultado.datos.codigos, mensaje: null, errorCodigo: null };
}
