'use server';

import { esquemaResumenNotificaciones, type ResumenNotificaciones } from '@sige/types';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { solicitarApi } from '@/lib/api';

export async function leerResumenNotificaciones(): Promise<ResumenNotificaciones | null> {
  const resultado = await solicitarApi('/notificaciones/resumen', { esquema: esquemaResumenNotificaciones });
  return resultado.ok ? resultado.datos : null;
}

export async function marcarNotificacionLeida(id: string): Promise<void> {
  if (!z.uuid().safeParse(id).success) {
    return;
  }

  await solicitarApi(`/notificaciones/${id}/lectura`, { metodo: 'POST', esquema: z.null() });
  revalidatePath('/notificaciones');
}

export async function marcarTodasLeidas(): Promise<void> {
  await solicitarApi('/notificaciones/lectura', { metodo: 'POST', esquema: z.null() });
  revalidatePath('/notificaciones');
}
