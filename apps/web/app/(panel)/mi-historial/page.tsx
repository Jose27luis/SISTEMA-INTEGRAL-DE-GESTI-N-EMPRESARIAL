import { redirect } from 'next/navigation';
import { obtenerPerfil } from '@/lib/profile';

export default async function PaginaMiHistorial(): Promise<never> {
  const perfil = await obtenerPerfil();
  redirect(`/historial/${perfil.usuario.id}`);
}
