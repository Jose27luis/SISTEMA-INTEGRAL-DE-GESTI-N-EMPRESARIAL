import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Plantilla, PlantillaEntrada } from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { esViolacionDeUnicidad } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';

const NOMBRE_DUPLICADO = new ConflictException({
  mensaje: 'Ya existe una plantilla con ese nombre.',
  errores: [{ campo: 'nombre', mensaje: 'Use otro nombre.' }],
});

@Injectable()
export class PlantillasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(soloActivas: boolean): Promise<Plantilla[]> {
    const plantillas = await this.prisma.plantillaTarea.findMany({
      where: soloActivas ? { activo: true } : {},
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      include: { _count: { select: { reglas: { where: { activo: true } } } } },
    });

    return plantillas.map((plantilla) => ({
      id: plantilla.id,
      nombre: plantilla.nombre,
      titulo: plantilla.titulo,
      instrucciones: plantilla.instrucciones,
      prioridad: plantilla.prioridad,
      diasPlazo: plantilla.diasPlazo,
      requiereAprobacion: plantilla.requiereAprobacion,
      requiereEvidencia: plantilla.requiereEvidencia,
      evidenciaRequerida: plantilla.evidenciaRequerida,
      items: plantilla.items,
      activo: plantilla.activo,
      reglas: plantilla._count.reglas,
    }));
  }

  async guardar(
    id: string | null,
    entrada: PlantillaEntrada,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const anterior = id === null ? null : await this.obtener(id);
    const datos = {
      ...entrada,
      evidenciaRequerida: entrada.requiereEvidencia ? entrada.evidenciaRequerida : null,
    };

    try {
      await this.prisma.$transaction(async (tx) => {
        const plantilla =
          id === null
            ? await tx.plantillaTarea.create({ data: { ...datos, creadoPorId: usuario.usuarioId } })
            : await tx.plantillaTarea.update({ where: { id }, data: datos });

        await this.auditoria.registrar(
          {
            actor: actorDesde(usuario, contexto),
            accion: anterior === null ? 'CREAR' : 'MODIFICAR',
            entidad: 'plantilla_tarea',
            entidadId: plantilla.id,
            ...(anterior === null ? {} : { antes: anterior }),
            despues: { ...datos },
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
      await tx.plantillaTarea.update({ where: { id }, data: { activo } });

      if (!activo) {
        await tx.reglaRecurrencia.updateMany({ where: { plantillaId: id, activo: true }, data: { activo: false } });
      }

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: activo ? 'ACTIVAR' : 'DESACTIVAR',
          entidad: 'plantilla_tarea',
          entidadId: id,
          antes: { activo: anterior.activo },
          despues: { activo, ...(activo ? {} : { reglasDesactivadas: true }) },
        },
        tx,
      );
    });
  }

  private async obtener(id: string): Promise<{
    nombre: string;
    titulo: string;
    diasPlazo: number;
    items: string[];
    activo: boolean;
  }> {
    const plantilla = await this.prisma.plantillaTarea.findUnique({
      where: { id },
      select: { nombre: true, titulo: true, diasPlazo: true, items: true, activo: true },
    });

    if (plantilla === null) {
      throw new NotFoundException({ mensaje: 'La plantilla no existe.', errores: [] });
    }

    return plantilla;
  }
}
