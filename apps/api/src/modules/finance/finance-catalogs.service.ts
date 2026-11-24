import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CatalogoFinanciero,
  ElementoFinanciero,
  OpcionesFinanzas,
  Proveedor,
  ProveedorEntrada,
  TipoServicio,
} from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { esViolacionDeUnicidad } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService, type ClienteBaseDatos } from '../audit/audit.service';

const ENTIDAD: Record<CatalogoFinanciero, string> = {
  servicios: 'servicio',
  'medios-pago': 'medio_pago',
  'categorias-egreso': 'categoria_egreso',
};

const NOMBRE_REPETIDO = new ConflictException({
  mensaje: 'Ya existe un elemento con ese nombre.',
  errores: [{ campo: 'nombre', mensaje: 'Use otro nombre.' }],
});

@Injectable()
export class CatalogosFinancierosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(catalogo: CatalogoFinanciero): Promise<ElementoFinanciero[]> {
    const orden = [{ activo: 'desc' as const }, { nombre: 'asc' as const }];

    switch (catalogo) {
      case 'servicios':
        return (
          await this.prisma.servicio.findMany({ orderBy: orden, include: { _count: { select: { contratados: true } } } })
        ).map((fila) => ({ id: fila.id, nombre: fila.nombre, tipo: fila.tipo, activo: fila.activo, enUso: fila._count.contratados }));
      case 'medios-pago':
        return (
          await this.prisma.medioPago.findMany({
            orderBy: orden,
            include: { _count: { select: { cobros: true, egresos: true } } },
          })
        ).map((fila) => ({
          id: fila.id,
          nombre: fila.nombre,
          tipo: null,
          activo: fila.activo,
          enUso: fila._count.cobros + fila._count.egresos,
        }));
      case 'categorias-egreso':
        return (
          await this.prisma.categoriaEgreso.findMany({ orderBy: orden, include: { _count: { select: { egresos: true } } } })
        ).map((fila) => ({ id: fila.id, nombre: fila.nombre, tipo: null, activo: fila.activo, enUso: fila._count.egresos }));
    }
  }

  async guardar(
    catalogo: CatalogoFinanciero,
    id: string | null,
    nombre: string,
    tipo: TipoServicio | null,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    if (catalogo === 'servicios' && tipo === null) {
      throw new BadRequestException({
        mensaje: 'Revise los datos ingresados.',
        errores: [{ campo: 'tipo', mensaje: 'Indique si el servicio es recurrente o por proyecto.' }],
      });
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const anterior = id === null ? null : await this.obtenerNombre(catalogo, id, tx);
        const nuevoId = await this.escribir(catalogo, id, nombre, tipo, tx);

        await this.auditoria.registrar(
          {
            actor: actorDesde(usuario, contexto),
            accion: id === null ? 'CREAR' : 'MODIFICAR',
            entidad: ENTIDAD[catalogo],
            entidadId: nuevoId,
            ...(anterior === null ? {} : { antes: { nombre: anterior } }),
            despues: { nombre, ...(tipo === null ? {} : { tipo }) },
          },
          tx,
        );
      });
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        throw NOMBRE_REPETIDO;
      }

      throw error;
    }
  }

  async cambiarActivo(
    catalogo: CatalogoFinanciero,
    id: string,
    activo: boolean,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.obtenerNombre(catalogo, id, tx);

      switch (catalogo) {
        case 'servicios':
          await tx.servicio.update({ where: { id }, data: { activo } });
          break;
        case 'medios-pago':
          await tx.medioPago.update({ where: { id }, data: { activo } });
          break;
        case 'categorias-egreso':
          await tx.categoriaEgreso.update({ where: { id }, data: { activo } });
          break;
      }

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: activo ? 'ACTIVAR' : 'DESACTIVAR',
          entidad: ENTIDAD[catalogo],
          entidadId: id,
          despues: { activo },
        },
        tx,
      );
    });
  }

  async opciones(usuario: UsuarioAutenticado): Promise<OpcionesFinanzas> {
    const activo = { activo: true };
    const [clientes, servicios, mediosPago, categorias, proveedores, responsables] = await Promise.all([
      this.prisma.cliente.findMany({
        where: { estado: { not: 'INACTIVO' } },
        orderBy: { razonSocial: 'asc' },
        select: { id: true, razonSocial: true },
      }),
      this.prisma.servicio.findMany({ where: activo, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true, tipo: true } }),
      this.prisma.medioPago.findMany({ where: activo, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
      this.prisma.categoriaEgreso.findMany({ where: activo, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
      this.prisma.proveedor.findMany({ where: activo, orderBy: { razonSocial: 'asc' }, select: { id: true, razonSocial: true } }),
      usuario.permisos.has('finanza:egresos')
        ? this.prisma.usuario.findMany({ where: activo, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } })
        : Promise.resolve([]),
    ]);

    return {
      clientes,
      servicios,
      mediosPago,
      categorias,
      proveedores,
      responsables,
      puedeIngresos: usuario.permisos.has('finanza:ingresos'),
      puedeEgresos: usuario.permisos.has('finanza:egresos'),
      puedeAnular: usuario.permisos.has('finanza:anular'),
    };
  }

  async listarProveedores(): Promise<Proveedor[]> {
    const proveedores = await this.prisma.proveedor.findMany({
      orderBy: [{ activo: 'desc' }, { razonSocial: 'asc' }],
      include: { _count: { select: { egresos: true } } },
    });

    return proveedores.map((proveedor) => ({
      id: proveedor.id,
      razonSocial: proveedor.razonSocial,
      ruc: proveedor.ruc,
      contacto: proveedor.contacto,
      activo: proveedor.activo,
      egresos: proveedor._count.egresos,
    }));
  }

  async guardarProveedor(
    id: string | null,
    entrada: ProveedorEntrada,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const anterior = id === null ? null : await tx.proveedor.findUnique({ where: { id } });

        if (id !== null && anterior === null) {
          throw new NotFoundException({ mensaje: 'El proveedor no existe.', errores: [] });
        }

        const proveedor =
          id === null ? await tx.proveedor.create({ data: entrada }) : await tx.proveedor.update({ where: { id }, data: entrada });

        await this.auditoria.registrar(
          {
            actor: actorDesde(usuario, contexto),
            accion: id === null ? 'CREAR' : 'MODIFICAR',
            entidad: 'proveedor',
            entidadId: proveedor.id,
            ...(anterior === null
              ? {}
              : { antes: { razonSocial: anterior.razonSocial, ruc: anterior.ruc, contacto: anterior.contacto } }),
            despues: { ...entrada },
          },
          tx,
        );
      });
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        throw new ConflictException({
          mensaje: 'Ya existe un proveedor con ese RUC o DNI.',
          errores: [{ campo: 'ruc', mensaje: 'Revise el documento.' }],
        });
      }

      throw error;
    }
  }

  async cambiarActivoProveedor(id: string, activo: boolean, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.proveedor.update({ where: { id }, data: { activo } });
      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: activo ? 'ACTIVAR' : 'DESACTIVAR',
          entidad: 'proveedor',
          entidadId: id,
          despues: { activo },
        },
        tx,
      );
    });
  }

  private async escribir(
    catalogo: CatalogoFinanciero,
    id: string | null,
    nombre: string,
    tipo: TipoServicio | null,
    tx: ClienteBaseDatos,
  ): Promise<string> {
    switch (catalogo) {
      case 'servicios': {
        const datos = { nombre, tipo: tipo ?? 'RECURRENTE' };
        const fila = id === null ? await tx.servicio.create({ data: datos }) : await tx.servicio.update({ where: { id }, data: datos });
        return fila.id;
      }
      case 'medios-pago': {
        const fila = id === null ? await tx.medioPago.create({ data: { nombre } }) : await tx.medioPago.update({ where: { id }, data: { nombre } });
        return fila.id;
      }
      case 'categorias-egreso': {
        const fila =
          id === null
            ? await tx.categoriaEgreso.create({ data: { nombre } })
            : await tx.categoriaEgreso.update({ where: { id }, data: { nombre } });
        return fila.id;
      }
    }
  }

  private async obtenerNombre(catalogo: CatalogoFinanciero, id: string, tx: ClienteBaseDatos): Promise<string> {
    const fila =
      catalogo === 'servicios'
        ? await tx.servicio.findUnique({ where: { id }, select: { nombre: true } })
        : catalogo === 'medios-pago'
          ? await tx.medioPago.findUnique({ where: { id }, select: { nombre: true } })
          : await tx.categoriaEgreso.findUnique({ where: { id }, select: { nombre: true } });

    if (fila === null) {
      throw new NotFoundException({ mensaje: 'El elemento no existe.', errores: [] });
    }

    return fila.nombre;
  }
}
