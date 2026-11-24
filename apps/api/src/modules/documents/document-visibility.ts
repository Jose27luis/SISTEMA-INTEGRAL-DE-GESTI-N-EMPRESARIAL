import type { Prisma } from '@prisma/client';
import type { UsuarioAutenticado } from '../../common/auth/authenticated-request';

export function filtroDocumentosVisibles(usuario: UsuarioAutenticado): Prisma.DocumentoWhereInput {
  if (usuario.alcance === 'GLOBAL') {
    return {};
  }

  const propios: Prisma.DocumentoWhereInput = { creadoPorId: usuario.usuarioId };

  if (usuario.alcance === 'PROPIO') {
    return { AND: [propios, { confidencialidad: 'NORMAL' }] };
  }

  return {
    AND: [
      { confidencialidad: 'NORMAL' },
      {
        OR: [
          propios,
          { cliente: { asignaciones: { some: { usuarioId: usuario.usuarioId, retiradoEn: null } } } },
        ],
      },
    ],
  };
}

export function puedeArchivarDocumento(usuario: UsuarioAutenticado, creadoPorId: string): boolean {
  return usuario.permisos.has('documento:gestionar') && (usuario.alcanceGlobal || creadoPorId === usuario.usuarioId);
}
