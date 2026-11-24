import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Carpeta, CarpetaEntrada } from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { esViolacionDeUnicidad } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
import { AccesoClientesService } from '../clients/client-access.service';
import { filtroDocumentosVisibles } from './document-visibility';

const NOMBRE_REPETIDO = new ConflictException({
  mensaje: 'Ya existe una carpeta con ese nombre en el mismo lugar.',
  errores: [{ campo: 'nombre', mensaje: 'Use otro nombre.' }],
});

const PROFUNDIDAD_MAXIMA = 5;

interface FilaCarpeta {
  id: string;
  nombre: string;
  padreId: string | null;
}

export function rutasDeCarpetas(carpetas: readonly FilaCarpeta[]): Map<string, string> {
  const porId = new Map(carpetas.map((carpeta) => [carpeta.id, carpeta]));
  const rutas = new Map<string, string>();

  const ruta = (carpeta: FilaCarpeta, profundidad: number): string => {
    const guardada = rutas.get(carpeta.id);

    if (guardada !== undefined) {
      return guardada;
    }

    const padre = carpeta.padreId === null ? undefined : porId.get(carpeta.padreId);
    const completa =
      padre === undefined || profundidad > PROFUNDIDAD_MAXIMA
        ? carpeta.nombre
        : `${ruta(padre, profundidad + 1)} / ${carpeta.nombre}`;
    rutas.set(carpeta.id, completa);
    return completa;
  };

  for (const carpeta of carpetas) {
    ruta(carpeta, 0);
  }

  return rutas;
}

@Injectable()
export class CarpetasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly accesoClientes: AccesoClientesService,
  ) {}

  async listar(clienteId: string, usuario: UsuarioAutenticado): Promise<Carpeta[]> {
    const carpetas = await this.prisma.carpeta.findMany({
      where: { clienteId },
      select: {
        id: true,
        nombre: true,
        padreId: true,
        _count: { select: { documentos: { where: { AND: [{ archivadoEn: null }, filtroDocumentosVisibles(usuario)] } } } },
      },
    });
    const rutas = rutasDeCarpetas(carpetas);

    return carpetas
      .map((carpeta) => ({
        id: carpeta.id,
        nombre: carpeta.nombre,
        padreId: carpeta.padreId,
        ruta: rutas.get(carpeta.id) ?? carpeta.nombre,
        documentos: carpeta._count.documentos,
      }))
      .sort((a, b) => a.ruta.localeCompare(b.ruta));
  }

  async crear(
    clienteId: string,
    entrada: CarpetaEntrada,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    await this.accesoClientes.asegurarAcceso(usuario, clienteId, contexto);

    if (entrada.padreId !== null) {
      await this.validarPadre(clienteId, entrada.padreId);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const carpeta = await tx.carpeta.create({
          data: { clienteId, padreId: entrada.padreId, nombre: entrada.nombre, creadoPorId: usuario.usuarioId },
        });

        await this.auditoria.registrar(
          {
            actor: actorDesde(usuario, contexto),
            accion: 'CREAR',
            entidad: 'carpeta',
            entidadId: carpeta.id,
            despues: { clienteId, ...entrada },
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

  async renombrar(
    clienteId: string,
    carpetaId: string,
    nombre: string,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    await this.accesoClientes.asegurarAcceso(usuario, clienteId, contexto);
    const anterior = await this.prisma.carpeta.findFirst({ where: { id: carpetaId, clienteId } });

    if (anterior === null) {
      throw new NotFoundException({ mensaje: 'La carpeta no existe en este cliente.', errores: [] });
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.carpeta.update({ where: { id: carpetaId }, data: { nombre } });
        await this.auditoria.registrar(
          {
            actor: actorDesde(usuario, contexto),
            accion: 'MODIFICAR',
            entidad: 'carpeta',
            entidadId: carpetaId,
            antes: { nombre: anterior.nombre },
            despues: { nombre },
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

  private async validarPadre(clienteId: string, padreId: string): Promise<void> {
    const carpetas = await this.prisma.carpeta.findMany({
      where: { clienteId },
      select: { id: true, padreId: true },
    });
    const porId = new Map(carpetas.map((carpeta) => [carpeta.id, carpeta.padreId]));

    if (!porId.has(padreId)) {
      throw new BadRequestException({
        mensaje: 'Revise los datos ingresados.',
        errores: [{ campo: 'padreId', mensaje: 'La carpeta superior no pertenece a este cliente.' }],
      });
    }

    let profundidad = 1;
    let actual = porId.get(padreId) ?? null;

    while (actual !== null) {
      profundidad += 1;
      actual = porId.get(actual) ?? null;
    }

    if (profundidad >= PROFUNDIDAD_MAXIMA) {
      throw new BadRequestException({
        mensaje: 'Revise los datos ingresados.',
        errores: [{ campo: 'padreId', mensaje: `Se permiten como máximo ${String(PROFUNDIDAD_MAXIMA)} niveles de carpetas.` }],
      });
    }
  }
}
