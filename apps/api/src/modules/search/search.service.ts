import { Injectable } from '@nestjs/common';
import type { ResultadosBusqueda } from '@sige/types';
import type { UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';
import { AccesoClientesService } from '../clients/client-access.service';
import { filtroDocumentosVisibles } from '../documents/document-visibility';
import { AccesoTareasService } from '../tasks/task-access.service';

const CANDIDATOS = 200;
const RESULTADOS_POR_GRUPO = 8;

export function patronBusqueda(consulta: string): string {
  return `%${consulta.replace(/[\\%_]/gu, (caracter) => `\\${caracter}`)}%`;
}

@Injectable()
export class BusquedaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accesoClientes: AccesoClientesService,
    private readonly accesoTareas: AccesoTareasService,
  ) {}

  async buscar(consulta: string, usuario: UsuarioAutenticado): Promise<ResultadosBusqueda> {
    const patron = patronBusqueda(consulta);
    const [clientes, tareas, documentos] = await Promise.all([
      usuario.permisos.has('cliente:ver') ? this.buscarClientes(patron, usuario) : Promise.resolve([]),
      usuario.permisos.has('tarea:ver') ? this.buscarTareas(patron, usuario) : Promise.resolve([]),
      usuario.permisos.has('documento:ver') ? this.buscarDocumentos(patron, usuario) : Promise.resolve([]),
    ]);

    return { consulta, clientes, tareas, documentos };
  }

  private async buscarClientes(patron: string, usuario: UsuarioAutenticado): Promise<ResultadosBusqueda['clientes']> {
    const candidatos = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM clientes
      WHERE unaccent(lower(razon_social)) LIKE unaccent(lower(${patron}))
         OR ruc LIKE ${patron}
         OR dni LIKE ${patron}
      ORDER BY razon_social
      LIMIT ${CANDIDATOS}`;
    const clientes = await this.prisma.cliente.findMany({
      where: { AND: [{ id: { in: candidatos.map(({ id }) => id) } }, this.accesoClientes.filtroVisible(usuario)] },
      orderBy: { razonSocial: 'asc' },
      take: RESULTADOS_POR_GRUPO,
      select: { id: true, razonSocial: true, ruc: true, dni: true },
    });

    return clientes.map((cliente) => ({
      id: cliente.id,
      razonSocial: cliente.razonSocial,
      documento: cliente.ruc === null ? (cliente.dni === null ? null : `DNI ${cliente.dni}`) : `RUC ${cliente.ruc}`,
    }));
  }

  private async buscarTareas(patron: string, usuario: UsuarioAutenticado): Promise<ResultadosBusqueda['tareas']> {
    const candidatos = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM tareas
      WHERE unaccent(lower(titulo)) LIKE unaccent(lower(${patron}))
         OR lower(codigo) LIKE lower(${patron})
      ORDER BY creado_en DESC
      LIMIT ${CANDIDATOS}`;
    const tareas = await this.prisma.tarea.findMany({
      where: { AND: [{ id: { in: candidatos.map(({ id }) => id) } }, this.accesoTareas.filtroVisible(usuario)] },
      orderBy: { creadoEn: 'desc' },
      take: RESULTADOS_POR_GRUPO,
      select: { id: true, codigo: true, titulo: true, cliente: { select: { razonSocial: true } } },
    });

    return tareas.map((tarea) => ({
      id: tarea.id,
      codigo: tarea.codigo,
      titulo: tarea.titulo,
      cliente: tarea.cliente?.razonSocial ?? null,
    }));
  }

  private async buscarDocumentos(patron: string, usuario: UsuarioAutenticado): Promise<ResultadosBusqueda['documentos']> {
    const candidatos = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM documentos
      WHERE archivado_en IS NULL AND unaccent(lower(titulo)) LIKE unaccent(lower(${patron}))
      ORDER BY actualizado_en DESC
      LIMIT ${CANDIDATOS}`;
    const documentos = await this.prisma.documento.findMany({
      where: { AND: [{ id: { in: candidatos.map(({ id }) => id) } }, filtroDocumentosVisibles(usuario)] },
      orderBy: { actualizadoEn: 'desc' },
      take: RESULTADOS_POR_GRUPO,
      select: {
        id: true,
        titulo: true,
        tipoDocumento: { select: { nombre: true } },
        cliente: { select: { razonSocial: true } },
      },
    });

    return documentos.map((documento) => ({
      id: documento.id,
      titulo: documento.titulo,
      tipo: documento.tipoDocumento.nombre,
      cliente: documento.cliente?.razonSocial ?? null,
    }));
  }
}
