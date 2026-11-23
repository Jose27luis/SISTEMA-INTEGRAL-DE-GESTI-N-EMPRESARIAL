import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ETIQUETAS_CATALOGO, type ElementoCatalogo, type TipoCatalogo } from '@sige/types';
import { esViolacionDeUnicidad } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { type ActorAuditoria, AuditoriaService, type ClienteBaseDatos } from '../audit/audit.service';

interface FilaCatalogo {
  id: string;
  nombre: string;
  activo: boolean;
}

const ENTIDAD_AUDITORIA: Record<TipoCatalogo, string> = {
  areas: 'area',
  cargos: 'cargo',
  'tipos-vinculo': 'tipo_vinculo',
  'regimenes-tributarios': 'regimen_tributario',
};

@Injectable()
export class CatalogosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(tipo: TipoCatalogo): Promise<ElementoCatalogo[]> {
    const orden = [{ activo: 'desc' as const }, { nombre: 'asc' as const }];

    switch (tipo) {
      case 'areas':
        return (
          await this.prisma.area.findMany({ orderBy: orden, include: { _count: { select: { trabajadores: true } } } })
        ).map((fila) => ({ id: fila.id, nombre: fila.nombre, activo: fila.activo, enUso: fila._count.trabajadores }));
      case 'cargos':
        return (
          await this.prisma.cargo.findMany({ orderBy: orden, include: { _count: { select: { trabajadores: true } } } })
        ).map((fila) => ({ id: fila.id, nombre: fila.nombre, activo: fila.activo, enUso: fila._count.trabajadores }));
      case 'tipos-vinculo':
        return (
          await this.prisma.tipoVinculo.findMany({
            orderBy: orden,
            include: { _count: { select: { trabajadores: true } } },
          })
        ).map((fila) => ({ id: fila.id, nombre: fila.nombre, activo: fila.activo, enUso: fila._count.trabajadores }));
      case 'regimenes-tributarios':
        return (
          await this.prisma.regimenTributario.findMany({
            orderBy: orden,
            include: { _count: { select: { clientes: true } } },
          })
        ).map((fila) => ({ id: fila.id, nombre: fila.nombre, activo: fila.activo, enUso: fila._count.clientes }));
    }
  }

  async crear(tipo: TipoCatalogo, nombre: string, actor: ActorAuditoria): Promise<void> {
    await this.ejecutarConUnicidad(tipo, async () => {
      await this.prisma.$transaction(async (tx) => {
        const creado = await this.insertar(tipo, nombre, tx);
        await this.auditoria.registrar(
          { actor, accion: 'CREAR', entidad: ENTIDAD_AUDITORIA[tipo], entidadId: creado.id, despues: { nombre } },
          tx,
        );
      });
    });
  }

  async renombrar(tipo: TipoCatalogo, id: string, nombre: string, actor: ActorAuditoria): Promise<void> {
    const anterior = await this.obtener(tipo, id);

    await this.ejecutarConUnicidad(tipo, async () => {
      await this.prisma.$transaction(async (tx) => {
        await this.actualizar(tipo, id, { nombre }, tx);
        await this.auditoria.registrar(
          {
            actor,
            accion: 'MODIFICAR',
            entidad: ENTIDAD_AUDITORIA[tipo],
            entidadId: id,
            antes: { nombre: anterior.nombre },
            despues: { nombre },
          },
          tx,
        );
      });
    });
  }

  async cambiarEstado(tipo: TipoCatalogo, id: string, activo: boolean, actor: ActorAuditoria): Promise<void> {
    const anterior = await this.obtener(tipo, id);

    if (anterior.activo === activo) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await this.actualizar(tipo, id, { activo }, tx);
      await this.auditoria.registrar(
        {
          actor,
          accion: activo ? 'ACTIVAR' : 'DESACTIVAR',
          entidad: ENTIDAD_AUDITORIA[tipo],
          entidadId: id,
          antes: { activo: anterior.activo },
          despues: { activo },
        },
        tx,
      );
    });
  }

  async asegurarActivo(tipo: TipoCatalogo, id: string, campo: string, db: ClienteBaseDatos): Promise<void> {
    const fila = await this.buscar(tipo, id, db);

    if (fila?.activo !== true) {
      throw new BadRequestException({
        mensaje: 'Revise los datos ingresados.',
        errores: [{ campo, mensaje: `El ${ETIQUETAS_CATALOGO[tipo].singular} seleccionado no existe o está desactivado.` }],
      });
    }
  }

  private async obtener(tipo: TipoCatalogo, id: string): Promise<FilaCatalogo> {
    const fila = await this.buscar(tipo, id, this.prisma);

    if (fila === null) {
      throw new NotFoundException({ mensaje: 'El elemento del catálogo no existe.', errores: [] });
    }

    return fila;
  }

  private buscar(tipo: TipoCatalogo, id: string, db: ClienteBaseDatos): Promise<FilaCatalogo | null> {
    switch (tipo) {
      case 'areas':
        return db.area.findUnique({ where: { id } });
      case 'cargos':
        return db.cargo.findUnique({ where: { id } });
      case 'tipos-vinculo':
        return db.tipoVinculo.findUnique({ where: { id } });
      case 'regimenes-tributarios':
        return db.regimenTributario.findUnique({ where: { id } });
    }
  }

  private insertar(tipo: TipoCatalogo, nombre: string, db: ClienteBaseDatos): Promise<FilaCatalogo> {
    switch (tipo) {
      case 'areas':
        return db.area.create({ data: { nombre } });
      case 'cargos':
        return db.cargo.create({ data: { nombre } });
      case 'tipos-vinculo':
        return db.tipoVinculo.create({ data: { nombre } });
      case 'regimenes-tributarios':
        return db.regimenTributario.create({ data: { nombre } });
    }
  }

  private actualizar(
    tipo: TipoCatalogo,
    id: string,
    datos: { nombre?: string; activo?: boolean },
    db: ClienteBaseDatos,
  ): Promise<FilaCatalogo> {
    switch (tipo) {
      case 'areas':
        return db.area.update({ where: { id }, data: datos });
      case 'cargos':
        return db.cargo.update({ where: { id }, data: datos });
      case 'tipos-vinculo':
        return db.tipoVinculo.update({ where: { id }, data: datos });
      case 'regimenes-tributarios':
        return db.regimenTributario.update({ where: { id }, data: datos });
    }
  }

  private async ejecutarConUnicidad(tipo: TipoCatalogo, operacion: () => Promise<void>): Promise<void> {
    try {
      await operacion();
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        throw new ConflictException({
          mensaje: 'Revise los datos ingresados.',
          errores: [{ campo: 'nombre', mensaje: `Ya existe un ${ETIQUETAS_CATALOGO[tipo].singular} con ese nombre.` }],
        });
      }

      throw error;
    }
  }
}
