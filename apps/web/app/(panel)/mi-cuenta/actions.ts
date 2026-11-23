'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { solicitarApi } from '@/lib/api';
import { leerTexto } from '@/lib/form-state';

export async function cerrarOtraSesion(datos: FormData): Promise<void> {
  const sesionId = z.uuid().safeParse(leerTexto(datos, 'sesionId'));

  if (sesionId.success) {
    await solicitarApi(`/auth/sesiones/${sesionId.data}/cierre`, { metodo: 'POST', esquema: z.null() });
  }

  revalidatePath('/mi-cuenta');
}
