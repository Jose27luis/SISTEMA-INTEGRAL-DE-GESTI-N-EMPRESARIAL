import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ESTADOS_CERRADOS, MAXIMO_ITEMS_VERIFICACION } from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
import { AccesoTareasService, type ParticipacionTarea } from './task-access.service';

function puedeEditarLista(participacion: ParticipacionTarea, usuario: UsuarioAutenticado): boolean {
  return (
    participacion.responsableId === usuario.usuarioId ||
    participacion.colaboradorIds.includes(usuario.usuarioId) ||
    participacion.asignadoPorId === usuario.usuarioId ||
    usuario.alcanceGlobal
  );
}

@Injectable()
export class ListaVerificacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoTareasService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async agregar(tareaId: string, texto: string, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<void> {
    const participacion = await this.prepararEdicion(tareaId, usuario, contexto);

    await this.prisma.$transaction(async (tx) => {
      const items = await tx.itemVerificacion.findMany({ where: { tareaId }, select: { orden: true } });

      if (items.length >= MAXIMO_ITEMS_VERIFICACION) {
        throw new ConflictException({
          mensaje: `La lista admite como máximo ${String(MAXIMO_ITEMS_VERIFICACION)} ítems.`,
          errores: [],
        });
      }

      const orden = items.reduce((mayor, item) => Math.max(mayor, item.orden + 1), 0);
      const item = await tx.itemVerificacion.create({ data: { tareaId: participacion.id, texto, orden } });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'CREAR',
          entidad: 'item_verificacion',
          entidadId: item.id,
          despues: { tareaId, texto },
        },
        tx,
      );
    });
  }

  async marcar(
    tareaId: string,
    itemId: string,
    completado: boolean,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    await this.prepararEdicion(tareaId, usuario, contexto);
    const item = await this.prisma.itemVerificacion.findFirst({ where: { id: itemId, tareaId } });

    if (item === null) {
      throw new NotFoundException({ mensaje: 'El ítem no existe en esta tarea.', errores: [] });
    }

    if ((item.completadoEn !== null) === completado) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.itemVerificacion.update({
        where: { id: itemId },
        data: completado
          ? { completadoEn: new Date(), completadoPorId: usuario.usuarioId }
          : { completadoEn: null, completadoPorId: null },
      });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'MODIFICAR',
          entidad: 'item_verificacion',
          entidadId: itemId,
          antes: { completado: !completado },
          despues: { completado, texto: item.texto },
        },
        tx,
      );
    });
  }

  private async prepararEdicion(
    tareaId: string,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<ParticipacionTarea> {
    const participacion = await this.acceso.obtenerVisible(usuario, tareaId, contexto);

    if (!puedeEditarLista(participacion, usuario)) {
      throw new ForbiddenException({
        mensaje: 'Solo el responsable, los colaboradores, quien asignó la tarea o Gerencia pueden usar la lista.',
        errores: [],
      });
    }

    const tarea = await this.prisma.tarea.findUniqueOrThrow({ where: { id: tareaId }, select: { estado: true } });

    if (ESTADOS_CERRADOS.includes(tarea.estado)) {
      throw new ConflictException({ mensaje: 'La tarea está cerrada y su lista ya no se modifica.', errores: [] });
    }

    return participacion;
  }
}
