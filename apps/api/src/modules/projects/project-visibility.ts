import type { Prisma } from '@prisma/client';
import type { UsuarioAutenticado } from '../../common/auth/authenticated-request';

export function filtroEquipoProyecto(usuarioId: string): Prisma.ProyectoWhereInput {
  return {
    OR: [{ responsableId: usuarioId }, { miembros: { some: { usuarioId, retiradoEn: null } } }],
  };
}

export function filtroProyectosVisibles(usuario: UsuarioAutenticado): Prisma.ProyectoWhereInput {
  if (usuario.alcance === 'GLOBAL') {
    return {};
  }

  const condiciones: Prisma.ProyectoWhereInput[] = [
    { responsableId: usuario.usuarioId },
    { creadoPorId: usuario.usuarioId },
    { miembros: { some: { usuarioId: usuario.usuarioId, retiradoEn: null } } },
  ];

  if (usuario.alcance === 'ASIGNADO') {
    condiciones.push({ cliente: { asignaciones: { some: { usuarioId: usuario.usuarioId, retiradoEn: null } } } });
  }

  return { OR: condiciones };
}
