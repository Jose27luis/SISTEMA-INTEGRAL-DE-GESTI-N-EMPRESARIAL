import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { DocumentoEsperadoEntrada } from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb } from '../../common/dates';
import { esViolacionDeUnicidad } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
import { AccesoClientesService } from '../clients/client-access.service';

@Injectable()
export class DocumentosEsperadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly accesoClientes: AccesoClientesService,
  ) {}

  async crear(
    clienteId: string,
    entrada: DocumentoEsperadoEntrada,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    await this.accesoClientes.asegurarAcceso(usuario, clienteId, contexto);
    const tipo = await this.prisma.tipoDocumento.findUnique({
      where: { id: entrada.tipoDocumentoId },
      select: { activo: true },
    });

    if (tipo?.activo !== true) {
      throw new BadRequestException({
        mensaje: 'Revise los datos ingresados.',
        errores: [{ campo: 'tipoDocumentoId', mensaje: 'Seleccione un tipo de documento activo.' }],
      });
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const existente = await tx.documento.findFirst({
          where: { clienteId, tipoDocumentoId: entrada.tipoDocumentoId, periodo: entrada.periodo, archivadoEn: null },
          orderBy: { creadoEn: 'asc' },
          select: { id: true },
        });
        const esperado = await tx.documentoEsperado.create({
          data: {
            clienteId,
            tipoDocumentoId: entrada.tipoDocumentoId,
            periodo: entrada.periodo,
            fechaLimite: aFechaDb(entrada.fechaLimite),
            descripcion: entrada.descripcion,
            creadoPorId: usuario.usuarioId,
            ...(existente === null ? {} : { documentoId: existente.id, recibidoEn: new Date() }),
          },
        });

        await this.auditoria.registrar(
          {
            actor: actorDesde(usuario, contexto),
            accion: 'CREAR',
            entidad: 'documento_esperado',
            entidadId: esperado.id,
            despues: { clienteId, ...entrada, recibidoCon: existente?.id ?? null },
          },
          tx,
        );
      });
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        throw new ConflictException({
          mensaje: 'Ese documento ya está registrado como esperado en el periodo.',
          errores: [{ campo: 'tipoDocumentoId', mensaje: 'Anule el registro anterior si necesita cambiarlo.' }],
        });
      }

      throw error;
    }
  }

  async anular(
    clienteId: string,
    esperadoId: string,
    motivo: string,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    await this.accesoClientes.asegurarAcceso(usuario, clienteId, contexto);
    const esperado = await this.prisma.documentoEsperado.findFirst({ where: { id: esperadoId, clienteId } });

    if (esperado === null) {
      throw new NotFoundException({ mensaje: 'El documento esperado no existe en este cliente.', errores: [] });
    }

    if (esperado.anuladoEn !== null) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.documentoEsperado.update({ where: { id: esperadoId }, data: { anuladoEn: new Date() } });
      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'DESACTIVAR',
          entidad: 'documento_esperado',
          entidadId: esperadoId,
          antes: { anulado: false },
          despues: { anulado: true },
          motivo,
        },
        tx,
      );
    });
  }
}
