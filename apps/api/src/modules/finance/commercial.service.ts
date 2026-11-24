import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ContratoEntrada, FichaComercial, ServicioContratadoEntrada } from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb, aFechaIso, aFechaIsoONula, fechaHoyEnLima } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
import { asegurarClienteExiste } from './finance-access';
import { sumarMontos } from './finance-rules';
import { aResumenIngreso, INCLUSION_INGRESO } from './income-mapper';

const MAXIMO_INGRESOS_EN_FICHA = 24;

@Injectable()
export class FichaComercialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async ficha(clienteId: string, usuario: UsuarioAutenticado): Promise<FichaComercial> {
    await asegurarClienteExiste(this.prisma, clienteId);
    const hoy = fechaHoyEnLima();
    const [contrato, servicios, ingresos, totales] = await Promise.all([
      this.prisma.contratoCliente.findUnique({
        where: { clienteId },
        include: { documento: { select: { id: true, titulo: true } } },
      }),
      this.prisma.servicioContratado.findMany({
        where: { clienteId },
        orderBy: [{ activo: 'desc' }, { desde: 'desc' }],
        include: { servicio: { select: { id: true, nombre: true, tipo: true } } },
      }),
      this.prisma.ingreso.findMany({
        where: { clienteId },
        include: INCLUSION_INGRESO,
        orderBy: [{ fechaEmision: 'desc' }, { creadoEn: 'desc' }],
        take: MAXIMO_INGRESOS_EN_FICHA,
      }),
      this.prisma.ingreso.aggregate({
        where: { clienteId, anuladoEn: null },
        _sum: { monto: true, montoPagado: true, saldo: true },
      }),
    ]);
    const vigentes = servicios.filter(
      (servicio) =>
        servicio.activo &&
        servicio.periodicidad === 'MENSUAL' &&
        aFechaIso(servicio.desde) <= hoy &&
        (servicio.hasta === null || aFechaIso(servicio.hasta) >= hoy),
    );

    return {
      clienteId,
      contrato:
        contrato === null
          ? null
          : {
              inicio: aFechaIso(contrato.inicio),
              vencimiento: aFechaIsoONula(contrato.vencimiento),
              diaPago: contrato.diaPago,
              condicionesPago: contrato.condicionesPago,
              observaciones: contrato.observaciones,
              documento: contrato.documento,
              vencido: contrato.vencimiento !== null && aFechaIso(contrato.vencimiento) < hoy,
            },
      servicios: servicios.map((servicio) => ({
        id: servicio.id,
        servicio: servicio.servicio,
        honorario: Number(servicio.honorario),
        periodicidad: servicio.periodicidad,
        desde: aFechaIso(servicio.desde),
        hasta: aFechaIsoONula(servicio.hasta),
        observaciones: servicio.observaciones,
        activo: servicio.activo,
      })),
      honorarioMensual: sumarMontos(vigentes.map((servicio) => Number(servicio.honorario))),
      pagos: {
        facturado: Number(totales._sum.monto ?? 0),
        cobrado: Number(totales._sum.montoPagado ?? 0),
        saldo: Number(totales._sum.saldo ?? 0),
      },
      ingresos: ingresos.map((ingreso) => aResumenIngreso(ingreso, hoy)),
      puedeGestionar: usuario.permisos.has('comercial:gestionar'),
      puedeRegistrarIngresos: usuario.permisos.has('finanza:ingresos'),
    };
  }

  async guardarContrato(
    clienteId: string,
    entrada: ContratoEntrada,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    await asegurarClienteExiste(this.prisma, clienteId);

    if (entrada.documentoId !== null) {
      const documento = await this.prisma.documento.count({
        where: { id: entrada.documentoId, clienteId, archivadoEn: null },
      });

      if (documento === 0) {
        throw new BadRequestException({
          mensaje: 'Revise los datos ingresados.',
          errores: [{ campo: 'documentoId', mensaje: 'El documento no pertenece a este cliente.' }],
        });
      }
    }

    const anterior = await this.prisma.contratoCliente.findUnique({ where: { clienteId } });
    const datos = {
      inicio: aFechaDb(entrada.inicio),
      vencimiento: entrada.vencimiento === null ? null : aFechaDb(entrada.vencimiento),
      diaPago: entrada.diaPago,
      condicionesPago: entrada.condicionesPago,
      observaciones: entrada.observaciones,
      documentoId: entrada.documentoId,
    };

    await this.prisma.$transaction(async (tx) => {
      const contrato = await tx.contratoCliente.upsert({
        where: { clienteId },
        create: { clienteId, ...datos },
        update: datos,
      });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: anterior === null ? 'CREAR' : 'MODIFICAR',
          entidad: 'contrato_cliente',
          entidadId: contrato.id,
          ...(anterior === null
            ? {}
            : {
                antes: {
                  inicio: aFechaIso(anterior.inicio),
                  vencimiento: aFechaIsoONula(anterior.vencimiento),
                  diaPago: anterior.diaPago,
                  condicionesPago: anterior.condicionesPago,
                },
              }),
          despues: { clienteId, ...entrada },
        },
        tx,
      );
    });
  }

  async guardarServicio(
    clienteId: string,
    servicioContratadoId: string | null,
    entrada: ServicioContratadoEntrada,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    await asegurarClienteExiste(this.prisma, clienteId);
    const servicio = await this.prisma.servicio.findUnique({ where: { id: entrada.servicioId }, select: { activo: true } });

    if (servicio?.activo !== true) {
      throw new BadRequestException({
        mensaje: 'Revise los datos ingresados.',
        errores: [{ campo: 'servicioId', mensaje: 'Seleccione un servicio activo.' }],
      });
    }

    const anterior =
      servicioContratadoId === null
        ? null
        : await this.prisma.servicioContratado.findFirst({ where: { id: servicioContratadoId, clienteId } });

    if (servicioContratadoId !== null && anterior === null) {
      throw new NotFoundException({ mensaje: 'El servicio no está contratado por este cliente.', errores: [] });
    }

    const datos = {
      servicioId: entrada.servicioId,
      honorario: entrada.honorario,
      periodicidad: entrada.periodicidad,
      desde: aFechaDb(entrada.desde),
      hasta: entrada.hasta === null ? null : aFechaDb(entrada.hasta),
      observaciones: entrada.observaciones,
    };

    await this.prisma.$transaction(async (tx) => {
      const contratado =
        servicioContratadoId === null
          ? await tx.servicioContratado.create({ data: { clienteId, ...datos } })
          : await tx.servicioContratado.update({ where: { id: servicioContratadoId }, data: datos });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: anterior === null ? 'CREAR' : 'MODIFICAR',
          entidad: 'servicio_contratado',
          entidadId: contratado.id,
          ...(anterior === null
            ? {}
            : {
                antes: {
                  servicioId: anterior.servicioId,
                  honorario: Number(anterior.honorario),
                  periodicidad: anterior.periodicidad,
                  desde: aFechaIso(anterior.desde),
                  hasta: aFechaIsoONula(anterior.hasta),
                },
              }),
          despues: { clienteId, ...entrada },
        },
        tx,
      );
    });
  }

  async desactivarServicio(
    clienteId: string,
    servicioContratadoId: string,
    motivo: string,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const contratado = await this.prisma.servicioContratado.findFirst({ where: { id: servicioContratadoId, clienteId } });

    if (contratado === null) {
      throw new NotFoundException({ mensaje: 'El servicio no está contratado por este cliente.', errores: [] });
    }

    if (!contratado.activo) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.servicioContratado.update({ where: { id: servicioContratadoId }, data: { activo: false } });
      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'DESACTIVAR',
          entidad: 'servicio_contratado',
          entidadId: servicioContratadoId,
          antes: { activo: true },
          despues: { activo: false },
          motivo,
        },
        tx,
      );
    });
  }
}
