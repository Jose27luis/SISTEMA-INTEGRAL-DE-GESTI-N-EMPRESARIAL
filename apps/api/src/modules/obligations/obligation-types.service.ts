import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { TipoObligacion, TipoObligacionEntrada } from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { esViolacionDeUnicidad } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';

const CODIGO_DUPLICADO = new ConflictException({
  mensaje: 'Ya existe un tipo de obligación con ese código.',
  errores: [{ campo: 'codigo', mensaje: 'Use otro código.' }],
});

@Injectable()
export class TiposObligacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(): Promise<TipoObligacion[]> {
    const tipos = await this.prisma.tipoObligacion.findMany({
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      include: { _count: { select: { obligaciones: { where: { activo: true } } } } },
    });

    return tipos.map((tipo) => ({
      id: tipo.id,
      codigo: tipo.codigo,
      nombre: tipo.nombre,
      descripcion: tipo.descripcion,
      usaCronograma: tipo.usaCronograma,
      diaVencimiento: tipo.diaVencimiento,
      diasAlerta: tipo.diasAlerta,
      activo: tipo.activo,
      clientesConfigurados: tipo._count.obligaciones,
    }));
  }

  async crear(entrada: TipoObligacionEntrada, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const tipo = await tx.tipoObligacion.create({ data: this.datos(entrada) });

        await this.auditoria.registrar(
          {
            actor: actorDesde(usuario, contexto),
            accion: 'CREAR',
            entidad: 'tipo_obligacion',
            entidadId: tipo.id,
            despues: { ...entrada },
          },
          tx,
        );
      });
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        throw CODIGO_DUPLICADO;
      }

      throw error;
    }
  }

  async editar(
    id: string,
    entrada: TipoObligacionEntrada,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const anterior = await this.obtener(id);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.tipoObligacion.update({ where: { id }, data: this.datos(entrada) });

        await this.auditoria.registrar(
          {
            actor: actorDesde(usuario, contexto),
            accion: 'MODIFICAR',
            entidad: 'tipo_obligacion',
            entidadId: id,
            antes: {
              codigo: anterior.codigo,
              nombre: anterior.nombre,
              usaCronograma: anterior.usaCronograma,
              diaVencimiento: anterior.diaVencimiento,
              diasAlerta: anterior.diasAlerta,
            },
            despues: { ...entrada },
          },
          tx,
        );
      });
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        throw CODIGO_DUPLICADO;
      }

      throw error;
    }
  }

  async cambiarActivo(
    id: string,
    activo: boolean,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const anterior = await this.obtener(id);

    if (anterior.activo === activo) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tipoObligacion.update({ where: { id }, data: { activo } });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: activo ? 'ACTIVAR' : 'DESACTIVAR',
          entidad: 'tipo_obligacion',
          entidadId: id,
          antes: { activo: anterior.activo },
          despues: { activo },
        },
        tx,
      );
    });
  }

  private async obtener(id: string): Promise<{
    codigo: string;
    nombre: string;
    usaCronograma: boolean;
    diaVencimiento: number | null;
    diasAlerta: number[];
    activo: boolean;
  }> {
    const tipo = await this.prisma.tipoObligacion.findUnique({ where: { id } });

    if (tipo === null) {
      throw new NotFoundException({ mensaje: 'El tipo de obligación no existe.', errores: [] });
    }

    return tipo;
  }

  private datos(entrada: TipoObligacionEntrada): {
    codigo: string;
    nombre: string;
    descripcion: string | null;
    usaCronograma: boolean;
    diaVencimiento: number | null;
    diasAlerta: number[];
  } {
    return {
      codigo: entrada.codigo,
      nombre: entrada.nombre,
      descripcion: entrada.descripcion,
      usaCronograma: entrada.usaCronograma,
      diaVencimiento: entrada.usaCronograma ? null : entrada.diaVencimiento,
      diasAlerta: entrada.diasAlerta,
    };
  }
}
