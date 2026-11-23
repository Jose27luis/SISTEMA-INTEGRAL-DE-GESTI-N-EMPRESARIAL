import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  type AvanceEntrada,
  type ComentarioEntrada,
  ESTADOS_CON_AVANCE,
  estadoTrasAccion,
  MAXIMO_EVIDENCIAS_POR_AVANCE,
} from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
import { NotificacionesService } from '../notifications/notifications.service';
import { detectarTipoArchivo, nombreSeguro, type TipoArchivo } from '../storage/file-signature';
import { AlmacenArchivos, type ArchivoGuardado } from '../storage/file-storage';
import { AccesoTareasService } from './task-access.service';

export interface ArchivoRecibido {
  nombre: string;
  contenido: Buffer;
}

interface EvidenciaPreparada {
  nombre: string;
  tipo: TipoArchivo;
  contenido: Buffer;
}

@Injectable()
export class AvancesTareaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoTareasService,
    private readonly auditoria: AuditoriaService,
    private readonly notificaciones: NotificacionesService,
    private readonly almacen: AlmacenArchivos,
  ) {}

  async registrar(
    tareaId: string,
    entrada: AvanceEntrada,
    archivos: readonly ArchivoRecibido[],
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const participacion = await this.acceso.obtenerVisible(usuario, tareaId, contexto);

    if (
      participacion.responsableId !== usuario.usuarioId &&
      !participacion.colaboradorIds.includes(usuario.usuarioId)
    ) {
      throw new ForbiddenException({
        mensaje: 'Solo el responsable o un colaborador puede registrar avances.',
        errores: [],
      });
    }

    const tarea = await this.prisma.tarea.findUniqueOrThrow({
      where: { id: tareaId },
      select: { codigo: true, titulo: true, estado: true, requiereAprobacion: true },
    });

    if (!ESTADOS_CON_AVANCE.includes(tarea.estado)) {
      throw new ConflictException({
        mensaje: 'La tarea no admite nuevos avances en su estado actual.',
        errores: [],
      });
    }

    if (entrada.corrigeAId !== null) {
      const corregido = await this.prisma.avance.count({ where: { id: entrada.corrigeAId, tareaId } });

      if (corregido === 0) {
        throw new BadRequestException({
          mensaje: 'Revise los datos ingresados.',
          errores: [{ campo: 'corrigeAId', mensaje: 'El avance a corregir no pertenece a esta tarea.' }],
        });
      }
    }

    const evidencias = this.prepararEvidencias(archivos);
    const carpeta = participacion.clienteId === null ? 'general' : `clientes/${participacion.clienteId}`;
    const guardados: { evidencia: EvidenciaPreparada; guardado: ArchivoGuardado }[] = [];

    for (const evidencia of evidencias) {
      guardados.push({
        evidencia,
        guardado: await this.almacen.guardar(evidencia.contenido, carpeta, evidencia.tipo.extension),
      });
    }

    const notificados = await this.prisma.$transaction(async (tx) => {
      const avance = await tx.avance.create({ data: { ...entrada, tareaId, autorId: usuario.usuarioId } });

      for (const { evidencia, guardado } of guardados) {
        const archivo = await tx.archivo.create({
          data: {
            rutaAlmacen: guardado.ruta,
            nombreOriginal: evidencia.nombre,
            mime: evidencia.tipo.mime,
            tamanoBytes: guardado.tamanoBytes,
            sha256: guardado.sha256,
            clienteId: participacion.clienteId,
            subidoPorId: usuario.usuarioId,
          },
        });

        await tx.evidencia.create({ data: { avanceId: avance.id, archivoId: archivo.id } });
      }

      await tx.tarea.update({
        where: { id: tareaId },
        data: {
          porcentajeAvance: entrada.porcentaje,
          minutosRegistrados: { increment: entrada.minutosDedicados },
          version: { increment: 1 },
        },
      });

      if (tarea.estado === 'PENDIENTE') {
        const destino = estadoTrasAccion('PENDIENTE', 'INICIAR', tarea.requiereAprobacion);

        if (destino !== null) {
          await tx.tarea.update({ where: { id: tareaId }, data: { estado: destino } });
          await tx.transicionTarea.create({
            data: {
              tareaId,
              desde: 'PENDIENTE',
              hacia: destino,
              usuarioId: usuario.usuarioId,
              comentario: 'Iniciada al registrar el primer avance',
            },
          });
        }
      }

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'CREAR',
          entidad: 'tarea',
          entidadId: tareaId,
          despues: {
            avanceId: avance.id,
            porcentaje: entrada.porcentaje,
            minutosDedicados: entrada.minutosDedicados,
            evidencias: guardados.map(({ evidencia, guardado }) => ({ nombre: evidencia.nombre, sha256: guardado.sha256 })),
          },
          motivo: 'Avance registrado',
        },
        tx,
      );

      return this.notificaciones.crear(
        {
          destinatarios: [
            participacion.asignadoPorId,
            participacion.responsableId,
            ...(participacion.revisorId === null ? [] : [participacion.revisorId]),
          ],
          tipo: 'AVANCE_REGISTRADO',
          titulo: `Avance en ${tarea.codigo}: ${String(entrada.porcentaje)} %`,
          mensaje: `${tarea.titulo} · ${entrada.actividad}`,
          enlace: `/tareas/${tareaId}`,
          entidad: 'tarea',
          entidadId: tareaId,
        },
        usuario.usuarioId,
        tx,
      );
    });

    await this.notificaciones.publicar(notificados);
  }

  async comentar(
    tareaId: string,
    entrada: ComentarioEntrada,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const participacion = await this.acceso.obtenerVisible(usuario, tareaId, contexto);
    const participantes = new Set([
      participacion.responsableId,
      participacion.asignadoPorId,
      ...participacion.colaboradorIds,
      ...(participacion.revisorId === null ? [] : [participacion.revisorId]),
    ]);
    const mencionados = [...new Set(entrada.mencionadoIds)];

    if (mencionados.some((mencionadoId) => !participantes.has(mencionadoId))) {
      throw new BadRequestException({
        mensaje: 'Revise los datos ingresados.',
        errores: [{ campo: 'mencionadoIds', mensaje: 'Solo puede mencionar a participantes de la tarea.' }],
      });
    }

    const tarea = await this.prisma.tarea.findUniqueOrThrow({ where: { id: tareaId }, select: { codigo: true } });

    const notificados = await this.prisma.$transaction(async (tx) => {
      const comentario = await tx.comentarioTarea.create({
        data: { tareaId, autorId: usuario.usuarioId, contenido: entrada.contenido, mencionados },
      });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'CREAR',
          entidad: 'tarea',
          entidadId: tareaId,
          despues: { comentarioId: comentario.id, mencionados },
          motivo: 'Comentario',
        },
        tx,
      );

      return this.notificaciones.crear(
        {
          destinatarios: mencionados,
          tipo: 'MENCION',
          titulo: `Lo mencionaron en ${tarea.codigo}`,
          mensaje: entrada.contenido.slice(0, 160),
          enlace: `/tareas/${tareaId}#comentarios`,
          entidad: 'tarea',
          entidadId: tareaId,
        },
        usuario.usuarioId,
        tx,
      );
    });

    await this.notificaciones.publicar(notificados);
  }

  private prepararEvidencias(archivos: readonly ArchivoRecibido[]): EvidenciaPreparada[] {
    if (archivos.length > MAXIMO_EVIDENCIAS_POR_AVANCE) {
      throw new BadRequestException({
        mensaje: `Puede adjuntar como máximo ${String(MAXIMO_EVIDENCIAS_POR_AVANCE)} archivos por avance.`,
        errores: [{ campo: 'evidencias', mensaje: 'Reduzca la cantidad de archivos.' }],
      });
    }

    const rechazados: string[] = [];
    const preparadas: EvidenciaPreparada[] = [];

    for (const archivo of archivos) {
      const nombre = nombreSeguro(archivo.nombre);
      const tipo = detectarTipoArchivo(archivo.contenido, nombre);

      if (tipo === null) {
        rechazados.push(nombre);
      } else {
        preparadas.push({ nombre, tipo, contenido: archivo.contenido });
      }
    }

    if (rechazados.length > 0) {
      throw new BadRequestException({
        mensaje: 'Hay archivos con un formato no permitido.',
        errores: [
          {
            campo: 'evidencias',
            mensaje: `No se aceptan: ${rechazados.join(', ')}. Formatos permitidos: PDF, imágenes (JPG, PNG, WEBP), Word y Excel.`,
          },
        ],
      });
    }

    return preparadas;
  }
}
