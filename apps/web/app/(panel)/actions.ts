'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { solicitarApi } from '@/lib/api';
import { eliminarSesion } from '@/lib/session-cookie';

export async function cerrarSesion(): Promise<void> {
  await solicitarApi('/auth/salida', { metodo: 'POST', esquema: z.null() });
  await eliminarSesion();
  redirect('/ingresar?motivo=salida');
}
