import type { Readable } from 'node:stream';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
import { filtroDocumentosVisibles } from '../documents/document-visibility';
import { filtroProyectosVisibles } from '../projects/project-visibility';
import { AlmacenArchivos } from '../storage/file-storage';
import { AccesoTareasService } from './task-access.service';

const TIPOS_CON_VISTA_PREVIA = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

export interface ArchivoParaEntregar {
  nombre: string;
  mime: string;
  tamanoBytes: number;
  enLinea: boolean;
  flujo: Readable;
}

@Injectable()
export class ArchivosTareaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoTareasService,
    private readonly auditoria: AuditoriaService,
    private readonly almacen: AlmacenArchivos,
  ) {}

  async entregar(
    archivoId: string,
    descargar: boolean,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<ArchivoParaEntregar> {
    const archivo = await this.prisma.archivo.findUnique({
      where: { id: archivoId },
      include: {
        evidencias: { take: 1, select: { avance: { select: { tareaId: true } } } },
        versiones: { take: 1, select: { documentoId: true, numero: true } },
        vouchers: { take: 1, select: { id: true } },
        comprobantesEgreso: { take: 1, select: { id: true } },
        entregables: { take: 1, select: { etapa: { select: { proyectoId: true } } } },
      },
    });

    if (archivo === null) {
      throw new NotFoundException({ mensaje: 'El archivo no existe.', errores: [] });
    }

    const tareaId = archivo.evidencias[0]?.avance.tareaId;
    const version = archivo.versiones[0];
    const financiero = archivo.vouchers.length > 0 || archivo.comprobantesEgreso.length > 0;
    const proyectoId = archivo.entregables[0]?.etapa.proyectoId;

    if (proyectoId !== undefined) {
      const visible = usuario.permisos.has('proyecto:ver')
        ? await this.prisma.proyecto.count({ where: { AND: [{ id: proyectoId }, filtroProyectosVisibles(usuario)] } })
        : 0;

      if (visible === 0) {
        await this.auditoria.registrar({
          actor: actorDesde(usuario, contexto),
          accion: 'PERMISO_DENEGADO',
          entidad: 'archivo',
          entidadId: archivo.id,
          motivo: 'Entregable de un proyecto fuera del alcance del usuario',
        });

        throw new ForbiddenException({ mensaje: 'No tiene acceso a este archivo.', errores: [] });
      }
    } else if (financiero) {
      const permitido =
        archivo.comprobantesEgreso.length > 0 ? usuario.permisos.has('finanza:egresos') : usuario.permisos.has('comercial:ver');

      if (!permitido) {
        await this.auditoria.registrar({
          actor: actorDesde(usuario, contexto),
          accion: 'PERMISO_DENEGADO',
          entidad: 'archivo',
          entidadId: archivo.id,
          motivo: 'Archivo financiero sin permiso',
        });

        throw new ForbiddenException({ mensaje: 'No tiene acceso a este archivo.', errores: [] });
      }
    } else if (version !== undefined) {
      const visible = usuario.permisos.has('documento:ver')
        ? await this.prisma.documento.count({
            where: { AND: [{ id: version.documentoId }, filtroDocumentosVisibles(usuario)] },
          })
        : 0;

      if (visible === 0) {
        await this.auditoria.registrar({
          actor: actorDesde(usuario, contexto),
          accion: 'PERMISO_DENEGADO',
          entidad: 'archivo',
          entidadId: archivo.id,
          motivo: 'Documento fuera del alcance del usuario',
        });

        throw new ForbiddenException({ mensaje: 'No tiene acceso a este archivo.', errores: [] });
      }
    } else if (tareaId === undefined) {
      const asignado =
        archivo.clienteId !== null &&
        (await this.prisma.asignacionCliente.count({
          where: { clienteId: archivo.clienteId, usuarioId: usuario.usuarioId, retiradoEn: null },
        })) > 0;

      if (!usuario.alcanceGlobal && !asignado) {
        throw new ForbiddenException({ mensaje: 'No tiene acceso a este archivo.', errores: [] });
      }
    } else {
      await this.acceso.obtenerVisible(usuario, tareaId, contexto);
    }

    await this.auditoria.registrar({
      actor: actorDesde(usuario, contexto),
      accion: 'DESCARGAR',
      entidad: 'archivo',
      entidadId: archivo.id,
      despues: {
        nombre: archivo.nombreOriginal,
        tareaId: tareaId ?? null,
        documentoId: version?.documentoId ?? null,
        version: version?.numero ?? null,
        modo: descargar ? 'descarga' : 'vista',
      },
    });

    return {
      nombre: archivo.nombreOriginal,
      mime: archivo.mime,
      tamanoBytes: archivo.tamanoBytes,
      enLinea: !descargar && TIPOS_CON_VISTA_PREVIA.has(archivo.mime),
      flujo: this.almacen.leer(archivo.rutaAlmacen),
    };
  }
}
