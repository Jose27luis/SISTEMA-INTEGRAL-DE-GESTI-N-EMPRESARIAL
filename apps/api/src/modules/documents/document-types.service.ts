import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { TipoDocumento, TipoDocumentoEntrada } from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { esViolacionDeUnicidad } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';

const NOMBRE_DUPLICADO = new ConflictException({
  mensaje: 'Ya existe un tipo de documento con ese nombre.',
  errores: [{ campo: 'nombre', mensaje: 'Use otro nombre.' }],
});

@Injectable()
export class TiposDocumentoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(): Promise<TipoDocumento[]> {
    const tipos = await this.prisma.tipoDocumento.findMany({
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      include: { _count: { select: { documentos: true } } },
    });

    return tipos.map((tipo) => ({
      id: tipo.id,
      nombre: tipo.nombre,
      admiteVencimiento: tipo.admiteVencimiento,
      activo: tipo.activo,
      documentos: tipo._count.documentos,
    }));
  }

  async guardar(
    id: string | null,
    entrada: TipoDocumentoEntrada,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const anterior = id === null ? null : await this.obtener(id);

    try {
      await this.prisma.$transaction(async (tx) => {
        const tipo =
          id === null
            ? await tx.tipoDocumento.create({ data: entrada })
            : await tx.tipoDocumento.update({ where: { id }, data: entrada });

        await this.auditoria.registrar(
          {
            actor: actorDesde(usuario, contexto),
            accion: anterior === null ? 'CREAR' : 'MODIFICAR',
            entidad: 'tipo_documento',
            entidadId: tipo.id,
            ...(anterior === null
              ? {}
              : { antes: { nombre: anterior.nombre, admiteVencimiento: anterior.admiteVencimiento } }),
            despues: { ...entrada },
          },
          tx,
        );
      });
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        throw NOMBRE_DUPLICADO;
      }

      throw error;
    }
  }

  async cambiarActivo(id: string, activo: boolean, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<void> {
    const anterior = await this.obtener(id);

    if (anterior.activo === activo) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tipoDocumento.update({ where: { id }, data: { activo } });
      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: activo ? 'ACTIVAR' : 'DESACTIVAR',
          entidad: 'tipo_documento',
          entidadId: id,
          antes: { activo: anterior.activo },
          despues: { activo },
        },
        tx,
      );
    });
  }

  private async obtener(id: string): Promise<{ nombre: string; admiteVencimiento: boolean; activo: boolean }> {
    const tipo = await this.prisma.tipoDocumento.findUnique({ where: { id } });

    if (tipo === null) {
      throw new NotFoundException({ mensaje: 'El tipo de documento no existe.', errores: [] });
    }

    return tipo;
  }
}
