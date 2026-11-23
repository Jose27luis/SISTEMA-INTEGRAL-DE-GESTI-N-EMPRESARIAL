import type { Readable } from 'node:stream';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
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
      include: { evidencias: { take: 1, select: { avance: { select: { tareaId: true } } } } },
    });

    if (archivo === null) {
      throw new NotFoundException({ mensaje: 'El archivo no existe.', errores: [] });
    }

    const tareaId = archivo.evidencias[0]?.avance.tareaId;

    if (tareaId === undefined) {
      if (!usuario.alcanceGlobal) {
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
      despues: { nombre: archivo.nombreOriginal, tareaId: tareaId ?? null, modo: descargar ? 'descarga' : 'vista' },
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
