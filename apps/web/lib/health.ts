import { esquemaEstadoSalud, type EstadoSalud } from '@sige/types';
import { leerEntorno } from './environment';

export async function consultarSalud(): Promise<EstadoSalud | null> {
  const { API_INTERNAL_URL } = leerEntorno();

  try {
    const respuesta = await fetch(`${API_INTERNAL_URL}/health`, { cache: 'no-store' });
    const datos: unknown = await respuesta.json();
    const resultado = esquemaEstadoSalud.safeParse(datos);

    return resultado.success ? resultado.data : null;
  } catch {
    return null;
  }
}
