import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  type CobroEntrada,
  type ComprobanteEntrada,
  FINANZAS_POR_PAGINA,
  type FiltroIngresos,
  type IngresoDetalle,
  type IngresoEntrada,
  type PaginaIngresos,
} from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb, aFechaIso, aIso, aIsoONulo, fechaHoyEnLima } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService, type ClienteBaseDatos } from '../audit/audit.service';
import { AlmacenArchivos } from '../storage/file-storage';
import { asegurarClienteExiste } from './finance-access';
import { type AdjuntoRecibido, guardarAdjuntoFinanciero, registrarAdjunto } from './finance-attachments';
import { aCentimos, restarMontos, sumarMontos } from './finance-rules';
import { aResumenIngreso, INCLUSION_INGRESO } from './income-mapper';

function errorCampo(campo: string, mensaje: string): BadRequestException {
  return new BadRequestException({ mensaje: 'Revise los datos ingresados.', errores: [{ campo, mensaje }] });
}

@Injectable()
export class IngresosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly almacen: AlmacenArchivos,
  ) {}

  async listar(filtro: FiltroIngresos): Promise<PaginaIngresos> {
    const hoy = fechaHoyEnLima();
    const condiciones: Prisma.IngresoWhereInput[] = [];

    if (filtro.clienteId !== undefined) {
      condiciones.push({ clienteId: filtro.clienteId });
    }

    if (filtro.periodo !== undefined) {
      condiciones.push({ periodo: filtro.periodo });
    }

    if (filtro.busqueda !== undefined) {
      condiciones.push({
        OR: [
          { concepto: { contains: filtro.busqueda, mode: 'insensitive' } },
          { serieNumero: { contains: filtro.busqueda, mode: 'insensitive' } },
        ],
      });
    }

    switch (filtro.estado) {
      case 'ANULADO':
        condiciones.push({ anuladoEn: { not: null } });
        break;
      case 'PAGADO':
        condiciones.push({ anuladoEn: null, saldo: 0 });
        break;
      case 'PARCIAL':
        condiciones.push({ anuladoEn: null, saldo: { gt: 0 }, montoPagado: { gt: 0 } });
        break;
      case 'PENDIENTE':
        condiciones.push({ anuladoEn: null, montoPagado: 0 });
        break;
      case undefined:
        break;
    }

    if (filtro.vencidos === 'si') {
      condiciones.push({ anuladoEn: null, saldo: { gt: 0 }, fechaVencimiento: { lt: aFechaDb(hoy) } });
    }

    const where: Prisma.IngresoWhereInput = { AND: condiciones };
    const [total, ingresos, sumas] = await Promise.all([
      this.prisma.ingreso.count({ where }),
      this.prisma.ingreso.findMany({
        where,
        include: INCLUSION_INGRESO,
        orderBy: [{ fechaVencimiento: 'desc' }, { creadoEn: 'desc' }],
        skip: (filtro.pagina - 1) * FINANZAS_POR_PAGINA,
        take: FINANZAS_POR_PAGINA,
      }),
      this.prisma.ingreso.aggregate({
        where: { AND: [where, { anuladoEn: null }] },
        _sum: { monto: true, montoPagado: true, saldo: true },
      }),
    ]);

    return {
      total,
      pagina: filtro.pagina,
      porPagina: FINANZAS_POR_PAGINA,
      elementos: ingresos.map((ingreso) => aResumenIngreso(ingreso, hoy)),
      totales: {
        monto: Number(sumas._sum.monto ?? 0),
        pagado: Number(sumas._sum.montoPagado ?? 0),
        saldo: Number(sumas._sum.saldo ?? 0),
      },
    };
  }

  async detalle(id: string, usuario: UsuarioAutenticado): Promise<IngresoDetalle> {
    const ingreso = await this.obtener(id);
    const hoy = fechaHoyEnLima();
    const completo = await this.prisma.ingreso.findUniqueOrThrow({
      where: { id },
      include: {
        ...INCLUSION_INGRESO,
        servicioContratado: { select: { servicio: { select: { nombre: true } } } },
        creadoPor: { select: { nombre: true } },
        cobros: {
          orderBy: [{ fecha: 'desc' }, { registradoEn: 'desc' }],
          include: {
            medioPago: { select: { nombre: true } },
            voucher: { select: { id: true, nombreOriginal: true } },
            registradoPor: { select: { nombre: true } },
          },
        },
      },
    });
    const anulado = completo.anuladoEn !== null;

    return {
      ...aResumenIngreso(completo, hoy),
      servicio: completo.servicioContratado?.servicio.nombre ?? null,
      cobros: completo.cobros.map((cobro) => ({
        id: cobro.id,
        fecha: aFechaIso(cobro.fecha),
        importe: Number(cobro.importe),
        medioPago: cobro.medioPago.nombre,
        operacion: cobro.operacion,
        voucher: cobro.voucher === null ? null : { id: cobro.voucher.id, nombre: cobro.voucher.nombreOriginal },
        registradoPor: cobro.registradoPor.nombre,
        registradoEn: aIso(cobro.registradoEn),
        anulado: cobro.anuladoEn !== null,
        motivoAnulacion: cobro.motivoAnulacion,
      })),
      creadoPor: completo.creadoPor?.nombre ?? 'Generación automática',
      creadoEn: aIso(completo.creadoEn),
      anuladoEn: aIsoONulo(completo.anuladoEn),
      motivoAnulacion: completo.motivoAnulacion,
      puedeCobrar: !anulado && aCentimos(Number(ingreso.saldo)) > 0 && usuario.permisos.has('finanza:ingresos'),
      puedeAnular: !anulado && usuario.permisos.has('finanza:anular'),
    };
  }

  async crear(entrada: IngresoEntrada, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<string> {
    await asegurarClienteExiste(this.prisma, entrada.clienteId);

    if (entrada.servicioContratadoId !== null) {
      const servicio = await this.prisma.servicioContratado.count({
        where: { id: entrada.servicioContratadoId, clienteId: entrada.clienteId },
      });

      if (servicio === 0) {
        throw errorCampo('servicioContratadoId', 'El servicio no está contratado por este cliente.');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const ingreso = await tx.ingreso.create({
        data: {
          clienteId: entrada.clienteId,
          servicioContratadoId: entrada.servicioContratadoId,
          concepto: entrada.concepto,
          periodo: entrada.periodo,
          tipoComprobante: entrada.tipoComprobante,
          serieNumero: entrada.serieNumero,
          fechaEmision: aFechaDb(entrada.fechaEmision),
          fechaVencimiento: aFechaDb(entrada.fechaVencimiento),
          monto: entrada.monto,
          saldo: entrada.monto,
          creadoPorId: usuario.usuarioId,
        },
      });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'CREAR',
          entidad: 'ingreso',
          entidadId: ingreso.id,
          despues: { ...entrada },
        },
        tx,
      );

      return ingreso.id;
    });
  }

  async registrarComprobante(
    id: string,
    entrada: ComprobanteEntrada,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const ingreso = await this.obtener(id);
    this.asegurarVigente(ingreso.anuladoEn);

    if (aFechaDb(entrada.fechaEmision) > ingreso.fechaVencimiento) {
      throw errorCampo('fechaEmision', 'La emisión no puede ser posterior al vencimiento.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ingreso.update({
        where: { id },
        data: {
          tipoComprobante: entrada.tipoComprobante,
          serieNumero: entrada.serieNumero,
          fechaEmision: aFechaDb(entrada.fechaEmision),
        },
      });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'MODIFICAR',
          entidad: 'ingreso',
          entidadId: id,
          antes: {
            tipoComprobante: ingreso.tipoComprobante,
            serieNumero: ingreso.serieNumero,
            fechaEmision: aFechaIso(ingreso.fechaEmision),
          },
          despues: { ...entrada },
          motivo: 'Comprobante registrado',
        },
        tx,
      );
    });
  }

  async registrarCobro(
    id: string,
    entrada: CobroEntrada,
    adjuntos: readonly AdjuntoRecibido[],
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const ingreso = await this.obtener(id);
    this.asegurarVigente(ingreso.anuladoEn);
    const medio = await this.prisma.medioPago.findUnique({ where: { id: entrada.medioPagoId }, select: { activo: true } });

    if (medio?.activo !== true) {
      throw errorCampo('medioPagoId', 'Seleccione un medio de pago activo.');
    }

    if (entrada.fecha > fechaHoyEnLima()) {
      throw errorCampo('fecha', 'La fecha del cobro no puede ser futura.');
    }

    const voucher = await guardarAdjuntoFinanciero(this.almacen, adjuntos, `clientes/${ingreso.clienteId}/cobros`, 'voucher');

    await this.prisma.$transaction(async (tx) => {
      const actual = await this.bloquear(tx, id);

      if (aCentimos(entrada.importe) > aCentimos(Number(actual.saldo))) {
        throw errorCampo('importe', `El cobro supera el saldo pendiente de S/ ${Number(actual.saldo).toFixed(2)}.`);
      }

      const voucherId = voucher === null ? null : await registrarAdjunto(tx, voucher, ingreso.clienteId, usuario.usuarioId);
      const cobro = await tx.cobro.create({
        data: {
          ingresoId: id,
          fecha: aFechaDb(entrada.fecha),
          importe: entrada.importe,
          medioPagoId: entrada.medioPagoId,
          operacion: entrada.operacion,
          voucherId,
          registradoPorId: usuario.usuarioId,
        },
      });
      const pagado = sumarMontos([Number(actual.montoPagado), entrada.importe]);

      await tx.ingreso.update({
        where: { id },
        data: { montoPagado: pagado, saldo: restarMontos(Number(actual.monto), pagado) },
      });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'CREAR',
          entidad: 'cobro',
          entidadId: cobro.id,
          despues: { ingresoId: id, ...entrada, voucher: voucher?.nombre ?? null, saldoAnterior: Number(actual.saldo) },
        },
        tx,
      );
    });
  }

  async anular(id: string, motivo: string, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<void> {
    const ingreso = await this.obtener(id);
    this.asegurarVigente(ingreso.anuladoEn);

    await this.prisma.$transaction(async (tx) => {
      await this.bloquear(tx, id);
      const cobrosVigentes = await tx.cobro.count({ where: { ingresoId: id, anuladoEn: null } });

      if (cobrosVigentes > 0) {
        throw new ConflictException({
          mensaje: 'El ingreso tiene cobros vigentes. Anule primero cada cobro con su motivo.',
          errores: [],
        });
      }

      await tx.ingreso.update({
        where: { id },
        data: { anuladoEn: new Date(), anuladoPorId: usuario.usuarioId, motivoAnulacion: motivo },
      });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'ANULAR',
          entidad: 'ingreso',
          entidadId: id,
          antes: { anulado: false, monto: Number(ingreso.monto) },
          despues: { anulado: true },
          motivo,
        },
        tx,
      );
    });
  }

  async anularCobro(
    id: string,
    cobroId: string,
    motivo: string,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    await this.obtener(id);

    await this.prisma.$transaction(async (tx) => {
      const actual = await this.bloquear(tx, id);
      const cobro = await tx.cobro.findFirst({ where: { id: cobroId, ingresoId: id } });

      if (cobro === null) {
        throw new NotFoundException({ mensaje: 'El cobro no pertenece a este ingreso.', errores: [] });
      }

      if (cobro.anuladoEn !== null) {
        throw new ConflictException({ mensaje: 'El cobro ya está anulado.', errores: [] });
      }

      const pagado = restarMontos(Number(actual.montoPagado), Number(cobro.importe));

      await tx.cobro.update({
        where: { id: cobroId },
        data: { anuladoEn: new Date(), anuladoPorId: usuario.usuarioId, motivoAnulacion: motivo },
      });
      await tx.ingreso.update({
        where: { id },
        data: { montoPagado: pagado, saldo: restarMontos(Number(actual.monto), pagado) },
      });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'ANULAR',
          entidad: 'cobro',
          entidadId: cobroId,
          antes: { anulado: false, importe: Number(cobro.importe) },
          despues: { anulado: true, saldoIngreso: restarMontos(Number(actual.monto), pagado) },
          motivo,
        },
        tx,
      );
    });
  }

  private async obtener(id: string): Promise<Prisma.IngresoGetPayload<object>> {
    const ingreso = await this.prisma.ingreso.findUnique({ where: { id } });

    if (ingreso === null) {
      throw new NotFoundException({ mensaje: 'El ingreso no existe.', errores: [] });
    }

    return ingreso;
  }

  private asegurarVigente(anuladoEn: Date | null): void {
    if (anuladoEn !== null) {
      throw new ConflictException({ mensaje: 'El ingreso está anulado y no admite cambios.', errores: [] });
    }
  }

  private async bloquear(tx: ClienteBaseDatos, id: string): Promise<{ monto: Prisma.Decimal; montoPagado: Prisma.Decimal; saldo: Prisma.Decimal }> {
    await tx.$queryRaw`SELECT id FROM ingresos WHERE id = ${id}::uuid FOR UPDATE`;
    return tx.ingreso.findUniqueOrThrow({ where: { id }, select: { monto: true, montoPagado: true, saldo: true } });
  }
}
