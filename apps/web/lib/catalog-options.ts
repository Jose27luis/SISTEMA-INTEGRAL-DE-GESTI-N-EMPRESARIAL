import 'server-only';
import { esquemaElementoCatalogo, type ReferenciaCatalogo, type TipoCatalogo } from '@sige/types';
import { solicitarApi } from './api';

export async function opcionesCatalogo(tipo: TipoCatalogo): Promise<ReferenciaCatalogo[]> {
  const resultado = await solicitarApi(`/catalogos/${tipo}`, { esquema: esquemaElementoCatalogo.array() });

  if (!resultado.ok) {
    throw new Error(resultado.error.mensaje);
  }

  return resultado.datos.filter(({ activo }) => activo).map(({ id, nombre }) => ({ id, nombre }));
}
