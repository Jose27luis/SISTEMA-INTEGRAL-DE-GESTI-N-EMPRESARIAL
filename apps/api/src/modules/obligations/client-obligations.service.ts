import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { FichaTributaria, GrupoClienteEntrada, ObligacionClienteEntrada } from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { esViolacionDeUnicidad } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { PermisosEfectivosService } from '../access-control/effective-permissions.service';
import { actorDesde, AuditoriaService, type ClienteBaseDatos } from '../audit/audit.service';
import { AccesoClientesService } from '../clients/client-access.service';
import { AccesoTareasService } from '../tasks/task-access.service';

const OBLIGACION_DUPLICADA = new ConflictException({
  mensaje: 'El cliente ya tiene configurada esa obligación.',
  errores: [{ campo: 'tipoObligacionId', mensaje: 'Edite la configuración existente o desactívela primero.' }],
});

@Injectable()
export class ObligacionesClienteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly accesoClientes: AccesoClientesService,
    private readonly accesoTareas: AccesoTareasService,
    private readonly permisos: PermisosEfectivosService,
  ) {}

  async ficha(clienteId: string, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<FichaTributaria> {
    await this.accesoClientes.asegurarAcceso(usuario, clienteId, contexto);

    const cliente = await this.prisma.cliente.findUniqueOrThrow({
      where: { id: clienteId },
      select: {
        id: true,
        ruc: true,
        grupoCronograma: true,
        obligaciones: {
          orderBy: [{ activo: 'desc' }, { tipoObligacion: { nombre: 'asc' } }],
          select: {
            id: true,
            desdePeriodo: true,
            hastaPeriodo: true,
            activo: true,
            tipoObligacion: { select: { id: true, codigo: true, nombre: true, usaCronograma: true } },
            responsable: { select: { id: true, nombre: true } },
            revisor: { select: { id: true, nombre: true } },
          },
        },
      },
    });

    return {
      clienteId: cliente.id,
      ruc: cliente.ruc,
      grupoCronograma: cliente.grupoCronograma,
      puedeGestionar: usuario.permisos.has('obligacion:gestionar'),
      obligaciones: cliente.obligaciones,
    };
  }

  async cambiarGrupo(
    clienteId: string,
    entrada: GrupoClienteEntrada,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    await this.accesoClientes.asegurarAcceso(usuario, clienteId, contexto);
    const anterior = await this.prisma.cliente.findUniqueOrThrow({
      where: { id: clienteId },
      select: { grupoCronograma: true },
    });

    if (anterior.grupoCronograma === entrada.grupoCronograma) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.cliente.update({ where: { id: clienteId }, data: { grupoCronograma: entrada.grupoCronograma } });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'MODIFICAR',
          entidad: 'cliente',
          entidadId: clienteId,
          antes: { grupoCronograma: anterior.grupoCronograma },
          despues: { grupoCronograma: entrada.grupoCronograma },
        },
        tx,
      );
    });
  }

  async agregar(
    clienteId: string,
    entrada: ObligacionClienteEntrada,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    await this.accesoClientes.asegurarAcceso(usuario, clienteId, contexto);

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.validar(clienteId, entrada, tx);

        const obligacion = await tx.obligacionCliente.create({
          data: {
            clienteId,
            tipoObligacionId: entrada.tipoObligacionId,
            responsableId: entrada.responsableId,
            revisorId: entrada.revisorId,
            desdePeriodo: entrada.desdePeriodo,
            hastaPeriodo: entrada.hastaPeriodo,
            configuradoPorId: usuario.usuarioId,
          },
        });

        await this.auditoria.registrar(
          {
            actor: actorDesde(usuario, contexto),
            accion: 'CREAR',
            entidad: 'obligacion_cliente',
            entidadId: obligacion.id,
            despues: { clienteId, ...entrada },
          },
          tx,
        );
      });
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        throw OBLIGACION_DUPLICADA;
      }

      throw error;
    }
  }

  async editar(
    clienteId: string,
    obligacionId: string,
    entrada: ObligacionClienteEntrada,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    await this.accesoClientes.asegurarAcceso(usuario, clienteId, contexto);
    const anterior = await this.obtener(clienteId, obligacionId);

    if (!anterior.activo) {
      throw new ConflictException({ mensaje: 'La obligación está desactivada. Configúrela de nuevo.', errores: [] });
    }

    if (anterior.tipoObligacionId !== entrada.tipoObligacionId) {
      throw new BadRequestException({
        mensaje: 'Revise los datos ingresados.',
        errores: [{ campo: 'tipoObligacionId', mensaje: 'El tipo no se cambia: desactive esta obligación y configure otra.' }],
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await this.validar(clienteId, entrada, tx);

      await tx.obligacionCliente.update({
        where: { id: obligacionId },
        data: {
          responsableId: entrada.responsableId,
          revisorId: entrada.revisorId,
          desdePeriodo: entrada.desdePeriodo,
          hastaPeriodo: entrada.hastaPeriodo,
        },
      });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'MODIFICAR',
          entidad: 'obligacion_cliente',
          entidadId: obligacionId,
          antes: {
            responsableId: anterior.responsableId,
            revisorId: anterior.revisorId,
            desdePeriodo: anterior.desdePeriodo,
            hastaPeriodo: anterior.hastaPeriodo,
          },
          despues: { ...entrada },
        },
        tx,
      );
    });
  }

  async desactivar(
    clienteId: string,
    obligacionId: string,
    motivo: string,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    await this.accesoClientes.asegurarAcceso(usuario, clienteId, contexto);
    const anterior = await this.obtener(clienteId, obligacionId);

    if (!anterior.activo) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.obligacionCliente.update({ where: { id: obligacionId }, data: { activo: false } });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'DESACTIVAR',
          entidad: 'obligacion_cliente',
          entidadId: obligacionId,
          antes: { activo: true },
          despues: { activo: false },
          motivo,
        },
        tx,
      );
    });
  }

  private async obtener(
    clienteId: string,
    obligacionId: string,
  ): Promise<{
    tipoObligacionId: string;
    responsableId: string;
    revisorId: string | null;
    desdePeriodo: string;
    hastaPeriodo: string | null;
    activo: boolean;
  }> {
    const obligacion = await this.prisma.obligacionCliente.findFirst({ where: { id: obligacionId, clienteId } });

    if (obligacion === null) {
      throw new NotFoundException({ mensaje: 'La obligación no existe en este cliente.', errores: [] });
    }

    return obligacion;
  }

  private async validar(clienteId: string, entrada: ObligacionClienteEntrada, db: ClienteBaseDatos): Promise<void> {
    const tipo = await db.tipoObligacion.findUnique({
      where: { id: entrada.tipoObligacionId },
      select: { activo: true, usaCronograma: true },
    });

    if (tipo?.activo !== true) {
      throw new BadRequestException({
        mensaje: 'Revise los datos ingresados.',
        errores: [{ campo: 'tipoObligacionId', mensaje: 'Seleccione un tipo de obligación activo.' }],
      });
    }

    if (tipo.usaCronograma) {
      const cliente = await db.cliente.findUniqueOrThrow({ where: { id: clienteId }, select: { ruc: true } });

      if (cliente.ruc === null) {
        throw new BadRequestException({
          mensaje: 'Revise los datos ingresados.',
          errores: [
            {
              campo: 'tipoObligacionId',
              mensaje: 'El cliente no tiene RUC: su vencimiento no se puede tomar del cronograma oficial.',
            },
          ],
        });
      }
    }

    await this.accesoTareas.asegurarParticipante(entrada.responsableId, clienteId, 'responsableId', db);

    if (entrada.revisorId !== null) {
      const nombre = await this.accesoTareas.asegurarParticipante(entrada.revisorId, clienteId, 'revisorId', db);

      if (!(await this.permisos.resolver(entrada.revisorId)).permisos.has('tarea:revisar')) {
        throw new BadRequestException({
          mensaje: 'Revise los datos ingresados.',
          errores: [{ campo: 'revisorId', mensaje: `${nombre} no tiene permiso para aprobar u observar tareas.` }],
        });
      }
    }
  }
}
