import { ConflictException, Injectable } from '@nestjs/common';
import type { ClienteBaseDatos } from '../audit/audit.service';
import { CODIGO_ROL_GERENCIA } from './effective-permissions.service';

@Injectable()
export class ContinuidadGerenciaService {
  async tieneRolGerencia(usuarioId: string, db: ClienteBaseDatos): Promise<boolean> {
    const total = await db.usuarioRol.count({
      where: { usuarioId, retiradoEn: null, rol: { codigo: CODIGO_ROL_GERENCIA } },
    });

    return total > 0;
  }

  async asegurarOtraGerencia(usuarioId: string, db: ClienteBaseDatos): Promise<void> {
    const otras = await db.usuarioRol.count({
      where: {
        usuarioId: { not: usuarioId },
        retiradoEn: null,
        rol: { codigo: CODIGO_ROL_GERENCIA, activo: true },
        usuario: { activo: true },
      },
    });

    if (otras === 0) {
      throw new ConflictException({
        mensaje: 'Debe quedar al menos un usuario activo con el rol Gerencia General.',
        errores: [],
      });
    }
  }
}
