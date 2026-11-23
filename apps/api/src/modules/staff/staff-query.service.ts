import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  EstadoTrabajador,
  TrabajadorDetalle,
  TrabajadorResumen,
  UsuarioSinFicha,
} from '@sige/types';
import { ESTADOS_CERRADOS } from '@sige/types';
import { aFechaIso, aFechaIsoONula } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';

const INCLUSION_TRABAJADOR = {
  usuario: {
    select: {
      correo: true,
      roles: {
        where: { retiradoEn: null },
        orderBy: { asignadoEn: 'asc' },
        include: { rol: { select: { id: true, codigo: true, nombre: true } } },
      },
      _count: { select: { asignaciones: { where: { retiradoEn: null } } } },
    },
  },
  cargo: { select: { id: true, nombre: true } },
  area: { select: { id: true, nombre: true } },
  tipoVinculo: { select: { id: true, nombre: true } },
  supervisor: { select: { id: true, nombres: true, apellidos: true } },
} satisfies Prisma.TrabajadorInclude;

type TrabajadorConRelaciones = Prisma.TrabajadorGetPayload<{ include: typeof INCLUSION_TRABAJADOR }>;

function aResumen(trabajador: TrabajadorConRelaciones): TrabajadorResumen {
  return {
    id: trabajador.id,
    usuarioId: trabajador.usuarioId,
    nombres: trabajador.nombres,
    apellidos: trabajador.apellidos,
    dni: trabajador.dni,
    correo: trabajador.usuario.correo,
    cargo: trabajador.cargo,
    area: trabajador.area,
    estado: trabajador.estado,
    fechaIncorporacion: aFechaIso(trabajador.fechaIncorporacion),
  };
}

function aDetalle(trabajador: TrabajadorConRelaciones, tareasAbiertas: number): TrabajadorDetalle {
  return {
    ...aResumen(trabajador),
    tipoVinculo: trabajador.tipoVinculo,
    horario: trabajador.horario,
    telefono: trabajador.telefono,
    funciones: trabajador.funciones,
    supervisor:
      trabajador.supervisor === null
        ? null
        : {
            id: trabajador.supervisor.id,
            nombre: `${trabajador.supervisor.nombres} ${trabajador.supervisor.apellidos}`,
          },
    fechaCese: aFechaIsoONula(trabajador.fechaCese),
    roles: trabajador.usuario.roles.map(({ rol }) => rol),
    clientesAsignados: trabajador.usuario._count.asignaciones,
    tareasAbiertas,
  };
}

@Injectable()
export class ConsultaPersonalService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(estado: EstadoTrabajador | undefined): Promise<TrabajadorResumen[]> {
    const trabajadores = await this.prisma.trabajador.findMany({
      where: estado === undefined ? {} : { estado },
      orderBy: [{ estado: 'asc' }, { apellidos: 'asc' }, { nombres: 'asc' }],
      include: INCLUSION_TRABAJADOR,
    });

    return trabajadores.map(aResumen);
  }

  async obtener(id: string): Promise<TrabajadorDetalle> {
    const trabajador = await this.prisma.trabajador.findUnique({ where: { id }, include: INCLUSION_TRABAJADOR });

    if (trabajador === null) {
      throw new NotFoundException({ mensaje: 'El trabajador no existe.', errores: [] });
    }

    const tareasAbiertas = await this.prisma.tarea.count({
      where: {
        estado: { notIn: [...ESTADOS_CERRADOS] },
        OR: [{ responsableId: trabajador.usuarioId }, { revisorId: trabajador.usuarioId }],
      },
    });

    return aDetalle(trabajador, tareasAbiertas);
  }

  async usuariosSinFicha(): Promise<UsuarioSinFicha[]> {
    return this.prisma.usuario.findMany({
      where: { trabajador: null, activo: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, correo: true },
    });
  }
}
