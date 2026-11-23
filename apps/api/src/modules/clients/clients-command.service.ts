import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { CambioEstadoCliente, ClienteEntrada } from '@sige/types';
import type { UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { type ActorAuditoria, AuditoriaService, type ClienteBaseDatos } from '../audit/audit.service';
import { CatalogosService } from '../catalogs/catalogs.service';

function datosCliente(entrada: ClienteEntrada): {
  tipoPersona: ClienteEntrada['tipoPersona'];
  razonSocial: string;
  ruc: string | null;
  dni: string | null;
  domicilioFiscal: string | null;
  representanteLegal: string | null;
  actividadEconomica: string | null;
  regimenTributarioId: string | null;
  fechaIncorporacion: Date;
  responsableId: string | null;
} {
  return {
    tipoPersona: entrada.tipoPersona,
    razonSocial: entrada.razonSocial,
    ruc: entrada.ruc,
    dni: entrada.dni,
    domicilioFiscal: entrada.domicilioFiscal,
    representanteLegal: entrada.representanteLegal,
    actividadEconomica: entrada.actividadEconomica,
    regimenTributarioId: entrada.regimenTributarioId,
    fechaIncorporacion: aFechaDb(entrada.fechaIncorporacion),
    responsableId: entrada.responsableId,
  };
}

@Injectable()
export class GestionClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly catalogos: CatalogosService,
  ) {}

  async crear(
    entrada: ClienteEntrada,
    usuario: UsuarioAutenticado,
    actor: ActorAuditoria,
    motivo: string | null = null,
  ): Promise<string> {
    await this.validar(entrada, null, this.prisma);

    return this.prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.create({
        data: { ...datosCliente(entrada), creadoPorId: usuario.usuarioId },
      });

      if (entrada.responsableId !== null) {
        await this.asegurarAsignacion(cliente.id, entrada.responsableId, actor, tx);
      }

      if (!usuario.alcanceGlobal && entrada.responsableId !== usuario.usuarioId) {
        await this.asegurarAsignacion(cliente.id, usuario.usuarioId, actor, tx);
      }

      await this.auditoria.registrar(
        {
          actor,
          accion: 'CREAR',
          entidad: 'cliente',
          entidadId: cliente.id,
          despues: { ...entrada },
          ...(motivo === null ? {} : { motivo }),
        },
        tx,
      );

      return cliente.id;
    });
  }

  async editar(id: string, entrada: ClienteEntrada, actor: ActorAuditoria): Promise<void> {
    const anterior = await this.prisma.cliente.findUniqueOrThrow({ where: { id } });

    await this.validar(entrada, id, this.prisma);

    await this.prisma.$transaction(async (tx) => {
      await tx.cliente.update({ where: { id }, data: datosCliente(entrada) });

      if (entrada.responsableId !== null && entrada.responsableId !== anterior.responsableId) {
        await this.asegurarAsignacion(id, entrada.responsableId, actor, tx);
      }

      await this.auditoria.registrar(
        {
          actor,
          accion: 'MODIFICAR',
          entidad: 'cliente',
          entidadId: id,
          antes: {
            tipoPersona: anterior.tipoPersona,
            razonSocial: anterior.razonSocial,
            ruc: anterior.ruc,
            dni: anterior.dni,
            domicilioFiscal: anterior.domicilioFiscal,
            representanteLegal: anterior.representanteLegal,
            actividadEconomica: anterior.actividadEconomica,
            regimenTributarioId: anterior.regimenTributarioId,
            responsableId: anterior.responsableId,
          },
          despues: { ...entrada },
        },
        tx,
      );
    });
  }

  async cambiarEstado(id: string, cambio: CambioEstadoCliente, actor: ActorAuditoria): Promise<void> {
    const anterior = await this.prisma.cliente.findUniqueOrThrow({ where: { id }, select: { estado: true } });

    if (anterior.estado === cambio.estado) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.cliente.update({ where: { id }, data: { estado: cambio.estado } });
      await this.auditoria.registrar(
        {
          actor,
          accion: cambio.estado === 'INACTIVO' ? 'DESACTIVAR' : cambio.estado === 'ACTIVO' ? 'ACTIVAR' : 'MODIFICAR',
          entidad: 'cliente',
          entidadId: id,
          antes: { estado: anterior.estado },
          despues: { estado: cambio.estado },
          motivo: cambio.motivo,
        },
        tx,
      );
    });
  }

  async validar(entrada: ClienteEntrada, clienteId: string | null, db: ClienteBaseDatos): Promise<void> {
    if (entrada.regimenTributarioId !== null) {
      await this.catalogos.asegurarActivo('regimenes-tributarios', entrada.regimenTributarioId, 'regimenTributarioId', db);
    }

    if (entrada.ruc !== null) {
      const mismoRuc = await db.cliente.findUnique({ where: { ruc: entrada.ruc }, select: { id: true } });

      if (mismoRuc !== null && mismoRuc.id !== clienteId) {
        throw new ConflictException({
          mensaje: 'Revise los datos ingresados.',
          errores: [{ campo: 'ruc', mensaje: 'Ya existe un cliente con ese RUC.' }],
        });
      }
    }

    if (entrada.dni !== null) {
      const mismoDni = await db.cliente.findUnique({ where: { dni: entrada.dni }, select: { id: true } });

      if (mismoDni !== null && mismoDni.id !== clienteId) {
        throw new ConflictException({
          mensaje: 'Revise los datos ingresados.',
          errores: [{ campo: 'dni', mensaje: 'Ya existe un cliente con ese DNI.' }],
        });
      }
    }

    if (entrada.responsableId !== null) {
      const responsable = await db.usuario.findUnique({
        where: { id: entrada.responsableId },
        select: { activo: true },
      });

      if (responsable?.activo !== true) {
        throw new BadRequestException({
          mensaje: 'Revise los datos ingresados.',
          errores: [{ campo: 'responsableId', mensaje: 'Seleccione un responsable activo.' }],
        });
      }
    }
  }

  private async asegurarAsignacion(
    clienteId: string,
    usuarioId: string,
    actor: ActorAuditoria,
    db: ClienteBaseDatos,
  ): Promise<void> {
    const existente = await db.asignacionCliente.findFirst({
      where: { clienteId, usuarioId, retiradoEn: null },
      select: { id: true },
    });

    if (existente !== null) {
      return;
    }

    await db.asignacionCliente.create({
      data: { clienteId, usuarioId, rolEnCliente: 'RESPONSABLE', asignadoPorId: actor.usuarioId },
    });
  }
}
