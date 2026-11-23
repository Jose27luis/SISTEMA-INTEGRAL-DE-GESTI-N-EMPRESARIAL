import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AsignacionEntrada, ContactoEntrada } from '@sige/types';
import { PrismaService } from '../../prisma/prisma.service';
import { type ActorAuditoria, AuditoriaService } from '../audit/audit.service';

@Injectable()
export class EquipoClienteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async agregarContacto(clienteId: string, entrada: ContactoEntrada, actor: ActorAuditoria): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (entrada.principal) {
        await tx.contactoCliente.updateMany({ where: { clienteId, principal: true }, data: { principal: false } });
      }

      const contacto = await tx.contactoCliente.create({ data: { ...entrada, clienteId } });

      await this.auditoria.registrar(
        {
          actor,
          accion: 'CREAR',
          entidad: 'cliente',
          entidadId: clienteId,
          despues: { contactoId: contacto.id, contacto: entrada.nombre, principal: entrada.principal },
          motivo: 'Contacto agregado',
        },
        tx,
      );
    });
  }

  async editarContacto(
    clienteId: string,
    contactoId: string,
    entrada: ContactoEntrada,
    actor: ActorAuditoria,
  ): Promise<void> {
    const anterior = await this.obtenerContacto(clienteId, contactoId);

    await this.prisma.$transaction(async (tx) => {
      if (entrada.principal) {
        await tx.contactoCliente.updateMany({
          where: { clienteId, principal: true, id: { not: contactoId } },
          data: { principal: false },
        });
      }

      await tx.contactoCliente.update({ where: { id: contactoId }, data: entrada });
      await this.auditoria.registrar(
        {
          actor,
          accion: 'MODIFICAR',
          entidad: 'cliente',
          entidadId: clienteId,
          antes: {
            contactoId,
            nombre: anterior.nombre,
            cargo: anterior.cargo,
            correo: anterior.correo,
            telefono: anterior.telefono,
            principal: anterior.principal,
          },
          despues: { contactoId, ...entrada },
          motivo: 'Contacto modificado',
        },
        tx,
      );
    });
  }

  async desactivarContacto(clienteId: string, contactoId: string, actor: ActorAuditoria): Promise<void> {
    const contacto = await this.obtenerContacto(clienteId, contactoId);

    await this.prisma.$transaction(async (tx) => {
      await tx.contactoCliente.update({ where: { id: contactoId }, data: { activo: false, principal: false } });
      await this.auditoria.registrar(
        {
          actor,
          accion: 'DESACTIVAR',
          entidad: 'cliente',
          entidadId: clienteId,
          despues: { contactoId, contacto: contacto.nombre },
          motivo: 'Contacto desactivado',
        },
        tx,
      );
    });
  }

  async asignar(clienteId: string, entrada: AsignacionEntrada, actor: ActorAuditoria): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: entrada.usuarioId },
      select: { activo: true, nombre: true },
    });

    if (usuario?.activo !== true) {
      throw new BadRequestException({
        mensaje: 'Revise los datos ingresados.',
        errores: [{ campo: 'usuarioId', mensaje: 'Seleccione un usuario activo.' }],
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const vigente = await tx.asignacionCliente.findFirst({
        where: { clienteId, usuarioId: entrada.usuarioId, retiradoEn: null },
      });

      if (vigente?.rolEnCliente === entrada.rolEnCliente) {
        return;
      }

      if (vigente === null) {
        await tx.asignacionCliente.create({
          data: { clienteId, ...entrada, asignadoPorId: actor.usuarioId },
        });
      } else {
        await tx.asignacionCliente.update({
          where: { id: vigente.id },
          data: { rolEnCliente: entrada.rolEnCliente },
        });
      }

      await this.auditoria.registrar(
        {
          actor,
          accion: vigente === null ? 'CREAR' : 'MODIFICAR',
          entidad: 'cliente',
          entidadId: clienteId,
          ...(vigente === null ? {} : { antes: { usuario: usuario.nombre, rolEnCliente: vigente.rolEnCliente } }),
          despues: { usuarioId: entrada.usuarioId, usuario: usuario.nombre, rolEnCliente: entrada.rolEnCliente },
          motivo: vigente === null ? 'Usuario asignado al cliente' : 'Rol en el cliente modificado',
        },
        tx,
      );
    });
  }

  async retirar(clienteId: string, asignacionId: string, actor: ActorAuditoria): Promise<void> {
    const asignacion = await this.prisma.asignacionCliente.findFirst({
      where: { id: asignacionId, clienteId, retiradoEn: null },
      include: { usuario: { select: { nombre: true } } },
    });

    if (asignacion === null) {
      throw new NotFoundException({ mensaje: 'La asignación no existe o ya fue retirada.', errores: [] });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.asignacionCliente.update({
        where: { id: asignacionId },
        data: { retiradoEn: new Date(), retiradoPorId: actor.usuarioId },
      });
      await this.auditoria.registrar(
        {
          actor,
          accion: 'DESACTIVAR',
          entidad: 'cliente',
          entidadId: clienteId,
          despues: { usuarioId: asignacion.usuarioId, usuario: asignacion.usuario.nombre },
          motivo: 'Usuario retirado del cliente',
        },
        tx,
      );
    });
  }

  private async obtenerContacto(
    clienteId: string,
    contactoId: string,
  ): Promise<{ nombre: string; cargo: string | null; correo: string | null; telefono: string | null; principal: boolean }> {
    const contacto = await this.prisma.contactoCliente.findFirst({
      where: { id: contactoId, clienteId, activo: true },
    });

    if (contacto === null) {
      throw new NotFoundException({ mensaje: 'El contacto no existe o está desactivado.', errores: [] });
    }

    return contacto;
  }
}
