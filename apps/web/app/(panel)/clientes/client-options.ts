import 'server-only';
import type { ReferenciaCatalogo } from '@sige/types';
import { z } from 'zod';
import { solicitarApi } from '@/lib/api';
import { opcionesCatalogo } from '@/lib/catalog-options';
import type { UsuarioOpcion } from './client-form';

const esquemaUsuarioAsignable = z.object({ id: z.uuid(), nombre: z.string(), correo: z.string() });

export type UsuarioAsignable = z.infer<typeof esquemaUsuarioAsignable>;

export async function usuariosAsignables(): Promise<UsuarioAsignable[]> {
  const resultado = await solicitarApi('/clientes/usuarios-asignables', {
    esquema: esquemaUsuarioAsignable.array(),
  });

  return resultado.ok ? resultado.datos : [];
}

export async function cargarOpcionesCliente(): Promise<{
  regimenes: ReferenciaCatalogo[];
  usuarios: UsuarioOpcion[];
}> {
  const [regimenes, usuarios] = await Promise.all([opcionesCatalogo('regimenes-tributarios'), usuariosAsignables()]);

  return { regimenes, usuarios: usuarios.map(({ id, nombre }) => ({ id, nombre })) };
}
