import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { type EgresoEntrada, FINANZAS_POR_PAGINA, type FiltroEgresos, type PaginaEgresos } from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb, aFechaIso, aIso, aIsoONulo, fechaHoyEnLima } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
import { AlmacenArchivos } from '../storage/file-storage';
import { type AdjuntoRecibido, guardarAdjuntoFinanciero, registrarAdjunto } from './finance-attachments';

const INCLUSION_EGRESO = {
  proveedor: { select: { id: true, razonSocial: true } },
  categoria: { select: { nombre: true } },
  comprobante: { select: { id: true, nombreOriginal: true } },
  responsable: { select: { id: true, nombre: true } },
  medioPago: { select: { nombre: true } },
  cliente: { select: { id: true, razonSocial: true } },
  creadoPor: { select: { nombre: true } },
} satisfies Prisma.EgresoInclude;

function errorCampo(campo: string, mensaje: string): BadRequestException {
  return new BadRequestException({ mensaje: 'Revise los datos ingresados.', errores: [{ campo, mensaje }] });
}

@Injectable()
export class EgresosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly almacen: AlmacenArchivos,
  ) {}

  async listar(filtro: FiltroEgresos): Promise<PaginaEgresos> {
    const condiciones: Prisma.EgresoWhereInput[] = [];

    if (filtro.anulados !== 'si') {
      condiciones.push({ anuladoEn: null });
    }

    if (filtro.desde !== undefined) {
      condiciones.push({ fecha: { gte: aFechaDb(filtro.desde) } });
    }

    if (filtro.hasta !== undefined) {
      condiciones.push({ fecha: { lte: aFechaDb(filtro.hasta) } });
    }

    if (filtro.categoriaId !== undefined) {
      condiciones.push({ categoriaId: filtro.categoriaId });
    }

    if (filtro.proveedorId !== undefined) {
      condiciones.push({ proveedorId: filtro.proveedorId });
    }

    const where: Prisma.EgresoWhereInput = { AND: condiciones };
    const [total, egresos, suma] = await Promise.all([
      this.prisma.egreso.count({ where }),
      this.prisma.egreso.findMany({
        where,
        include: INCLUSION_EGRESO,
        orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
        skip: (filtro.pagina - 1) * FINANZAS_POR_PAGINA,
        take: FINANZAS_POR_PAGINA,
      }),
      this.prisma.egreso.aggregate({ where: { AND: [where, { anuladoEn: null }] }, _sum: { importe: true } }),
    ]);

    return {
      total,
      pagina: filtro.pagina,
      porPagina: FINANZAS_POR_PAGINA,
      importeTotal: Number(suma._sum.importe ?? 0),
      elementos: egresos.map((egreso) => ({
        id: egreso.id,
        concepto: egreso.concepto,
        proveedor: egreso.proveedor,
        fecha: aFechaIso(egreso.fecha),
        importe: Number(egreso.importe),
        categoria: egreso.categoria.nombre,
        tipoComprobante: egreso.tipoComprobante,
        serieNumero: egreso.serieNumero,
        comprobante: egreso.comprobante === null ? null : { id: egreso.comprobante.id, nombre: egreso.comprobante.nombreOriginal },
        responsable: egreso.responsable,
        medioPago: egreso.medioPago.nombre,
        cliente: egreso.cliente,
        observaciones: egreso.observaciones,
        registradoPor: egreso.creadoPor.nombre,
        registradoEn: aIso(egreso.creadoEn),
        anulado: egreso.anuladoEn !== null,
        anuladoEn: aIsoONulo(egreso.anuladoEn),
        motivoAnulacion: egreso.motivoAnulacion,
      })),
    };
  }

  async crear(
    entrada: EgresoEntrada,
    adjuntos: readonly AdjuntoRecibido[],
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<string> {
    if (entrada.fecha > fechaHoyEnLima()) {
      throw errorCampo('fecha', 'La fecha del egreso no puede ser futura.');
    }

    const [categoria, medio, responsable, proveedor, cliente] = await Promise.all([
      this.prisma.categoriaEgreso.findUnique({ where: { id: entrada.categoriaId }, select: { activo: true } }),
      this.prisma.medioPago.findUnique({ where: { id: entrada.medioPagoId }, select: { activo: true } }),
      this.prisma.usuario.findUnique({ where: { id: entrada.responsableId }, select: { activo: true } }),
      entrada.proveedorId === null
        ? Promise.resolve(null)
        : this.prisma.proveedor.findUnique({ where: { id: entrada.proveedorId }, select: { activo: true } }),
      entrada.clienteId === null
        ? Promise.resolve(null)
        : this.prisma.cliente.findUnique({ where: { id: entrada.clienteId }, select: { id: true } }),
    ]);

    if (categoria?.activo !== true) {
      throw errorCampo('categoriaId', 'Seleccione una categoría activa.');
    }

    if (medio?.activo !== true) {
      throw errorCampo('medioPagoId', 'Seleccione un medio de pago activo.');
    }

    if (responsable?.activo !== true) {
      throw errorCampo('responsableId', 'Seleccione un usuario activo.');
    }

    if (entrada.proveedorId !== null && proveedor?.activo !== true) {
      throw errorCampo('proveedorId', 'Seleccione un proveedor activo.');
    }

    if (entrada.clienteId !== null && cliente === null) {
      throw errorCampo('clienteId', 'El cliente no existe.');
    }

    const comprobante = await guardarAdjuntoFinanciero(this.almacen, adjuntos, 'egresos', 'comprobante');

    return this.prisma.$transaction(async (tx) => {
      const comprobanteId =
        comprobante === null ? null : await registrarAdjunto(tx, comprobante, entrada.clienteId, usuario.usuarioId);
      const egreso = await tx.egreso.create({
        data: {
          concepto: entrada.concepto,
          proveedorId: entrada.proveedorId,
          fecha: aFechaDb(entrada.fecha),
          importe: entrada.importe,
          categoriaId: entrada.categoriaId,
          tipoComprobante: entrada.tipoComprobante,
          serieNumero: entrada.serieNumero,
          comprobanteId,
          responsableId: entrada.responsableId,
          medioPagoId: entrada.medioPagoId,
          clienteId: entrada.clienteId,
          observaciones: entrada.observaciones,
          creadoPorId: usuario.usuarioId,
        },
      });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'CREAR',
          entidad: 'egreso',
          entidadId: egreso.id,
          despues: { ...entrada, comprobante: comprobante?.nombre ?? null },
        },
        tx,
      );

      return egreso.id;
    });
  }

  async anular(id: string, motivo: string, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<void> {
    const egreso = await this.prisma.egreso.findUnique({ where: { id }, select: { anuladoEn: true, importe: true } });

    if (egreso === null) {
      throw new NotFoundException({ mensaje: 'El egreso no existe.', errores: [] });
    }

    if (egreso.anuladoEn !== null) {
      throw new ConflictException({ mensaje: 'El egreso ya está anulado.', errores: [] });
    }

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.egreso.updateMany({
        where: { id, anuladoEn: null },
        data: { anuladoEn: new Date(), anuladoPorId: usuario.usuarioId, motivoAnulacion: motivo },
      });

      if (count === 0) {
        throw new ConflictException({ mensaje: 'El egreso ya está anulado.', errores: [] });
      }

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'ANULAR',
          entidad: 'egreso',
          entidadId: id,
          antes: { anulado: false, importe: Number(egreso.importe) },
          despues: { anulado: true },
          motivo,
        },
        tx,
      );
    });
  }
}
