import 'server-only';
import { esquemaTrabajadorResumen } from '@sige/types';
import { solicitarApi } from '@/lib/api';
import { opcionesCatalogo } from '@/lib/catalog-options';
import type { OpcionesFicha } from './staff-form';

export async function cargarOpcionesFicha(): Promise<OpcionesFicha> {
  const [areas, cargos, tiposVinculo, supervisores] = await Promise.all([
    opcionesCatalogo('areas'),
    opcionesCatalogo('cargos'),
    opcionesCatalogo('tipos-vinculo'),
    solicitarApi('/personal?estado=ACTIVO', { esquema: esquemaTrabajadorResumen.array() }),
  ]);

  return { areas, cargos, tiposVinculo, supervisores: supervisores.ok ? supervisores.datos : [] };
}
