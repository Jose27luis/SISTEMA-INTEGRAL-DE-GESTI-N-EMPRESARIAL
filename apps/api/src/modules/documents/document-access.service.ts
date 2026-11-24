import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
import { filtroDocumentosVisibles } from './document-visibility';

export interface DocumentoVisible {
  id: string;
  clienteId: string | null;
  creadoPorId: string;
  versionActual: number;
  archivadoEn: Date | null;
}

@Injectable()
export class AccesoDocumentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async obtenerVisible(id: string, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<DocumentoVisible> {
    const documento = await this.prisma.documento.findUnique({
      where: { id },
      select: { id: true, clienteId: true, creadoPorId: true, versionActual: true, archivadoEn: true },
    });

    if (documento === null) {
      throw new NotFoundException({ mensaje: 'El documento no existe.', errores: [] });
    }

    const visible = await this.prisma.documento.count({
      where: { AND: [{ id }, filtroDocumentosVisibles(usuario)] },
    });

    if (visible === 0) {
      await this.auditoria.registrar({
        actor: actorDesde(usuario, contexto),
        accion: 'PERMISO_DENEGADO',
        entidad: 'documento',
        entidadId: id,
        motivo: 'Documento fuera del alcance del usuario',
      });

      throw new ForbiddenException({ mensaje: 'No tiene acceso a este documento.', errores: [] });
    }

    return documento;
  }
}
