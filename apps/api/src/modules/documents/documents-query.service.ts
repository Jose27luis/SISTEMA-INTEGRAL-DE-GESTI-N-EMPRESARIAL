import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  DOCUMENTOS_POR_PAGINA,
  type DocumentoDetalle,
  type DocumentoResumen,
  type ExpedienteDocumental,
  type FiltroDocumentos,
  type IndicadoresDocumentales,
  type OpcionesDocumentos,
  type PaginaDocumentos,
} from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb, aFechaIso, aFechaIsoONula, aIso, aIsoONulo, fechaHoyEnLima, finDelDiaEnLima, inicioDelDiaEnLima } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { AccesoClientesService } from '../clients/client-access.service';
import { AccesoTareasService } from '../tasks/task-access.service';
import { AccesoDocumentosService } from './document-access.service';
import { filtroDocumentosVisibles, puedeArchivarDocumento } from './document-visibility';
import { CarpetasService } from './folders.service';

const DIAS_POR_VENCER = 30;
const MAXIMO_ARCHIVOS_DE_TAREAS = 200;

const INCLUSION_RESUMEN = {
  tipoDocumento: { select: { id: true, nombre: true } },
  cliente: { select: { id: true, razonSocial: true } },
  carpeta: { select: { id: true, nombre: true } },
  versiones: {
    orderBy: { numero: 'desc' },
    take: 1,
    select: { archivo: { select: { id: true, nombreOriginal: true, mime: true, tamanoBytes: true } } },
  },
} satisfies Prisma.DocumentoInclude;

type DocumentoConRelaciones = Prisma.DocumentoGetPayload<{ include: typeof INCLUSION_RESUMEN }>;

function sumarDias(fecha: string, dias: number): string {
  const resultado = aFechaDb(fecha);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return aFechaIso(resultado);
}

function aResumen(documento: DocumentoConRelaciones, hoy: string): DocumentoResumen {
  const vencimiento = aFechaIsoONula(documento.fechaVencimiento);
  const archivo = documento.versiones[0]?.archivo;

  if (archivo === undefined) {
    throw new Error(`El documento ${documento.id} no tiene versiones`);
  }

  return {
    id: documento.id,
    titulo: documento.titulo,
    tipoDocumento: documento.tipoDocumento,
    cliente: documento.cliente,
    carpeta: documento.carpeta,
    periodo: documento.periodo,
    fechaDocumento: aFechaIsoONula(documento.fechaDocumento),
    fechaVencimiento: vencimiento,
    vencido: vencimiento !== null && vencimiento < hoy,
    porVencer: vencimiento !== null && vencimiento >= hoy && vencimiento <= sumarDias(hoy, DIAS_POR_VENCER),
    versionActual: documento.versionActual,
    confidencialidad: documento.confidencialidad,
    archivado: documento.archivadoEn !== null,
    archivo: { id: archivo.id, nombre: archivo.nombreOriginal, mime: archivo.mime, tamanoBytes: archivo.tamanoBytes },
    actualizadoEn: aIso(documento.actualizadoEn),
  };
}

@Injectable()
export class ConsultaDocumentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoDocumentosService,
    private readonly accesoClientes: AccesoClientesService,
    private readonly accesoTareas: AccesoTareasService,
    private readonly carpetas: CarpetasService,
  ) {}

  async listar(filtro: FiltroDocumentos, usuario: UsuarioAutenticado): Promise<PaginaDocumentos> {
    const hoy = fechaHoyEnLima();
    const condiciones: Prisma.DocumentoWhereInput[] = [
      filtroDocumentosVisibles(usuario),
      { archivadoEn: filtro.archivados === 'si' ? { not: null } : null },
    ];

    if (filtro.busqueda !== undefined) {
      condiciones.push({ titulo: { contains: filtro.busqueda, mode: 'insensitive' } });
    }

    if (filtro.clienteId !== undefined) {
      condiciones.push({ clienteId: filtro.clienteId });
    }

    if (filtro.carpetaId !== undefined) {
      condiciones.push({ carpetaId: filtro.carpetaId });
    }

    if (filtro.tipoDocumentoId !== undefined) {
      condiciones.push({ tipoDocumentoId: filtro.tipoDocumentoId });
    }

    if (filtro.periodo !== undefined) {
      condiciones.push({ periodo: filtro.periodo });
    }

    if (filtro.desde !== undefined) {
      condiciones.push({ creadoEn: { gte: inicioDelDiaEnLima(filtro.desde) } });
    }

    if (filtro.hasta !== undefined) {
      condiciones.push({ creadoEn: { lte: finDelDiaEnLima(filtro.hasta) } });
    }

    if (filtro.vencimiento === 'por-vencer') {
      condiciones.push({ fechaVencimiento: { gte: aFechaDb(hoy), lte: aFechaDb(sumarDias(hoy, DIAS_POR_VENCER)) } });
    } else if (filtro.vencimiento === 'vencidos') {
      condiciones.push({ fechaVencimiento: { lt: aFechaDb(hoy) } });
    }

    const where: Prisma.DocumentoWhereInput = { AND: condiciones };
    const [total, documentos] = await Promise.all([
      this.prisma.documento.count({ where }),
      this.prisma.documento.findMany({
        where,
        include: INCLUSION_RESUMEN,
        orderBy: [{ actualizadoEn: 'desc' }, { id: 'asc' }],
        skip: (filtro.pagina - 1) * DOCUMENTOS_POR_PAGINA,
        take: DOCUMENTOS_POR_PAGINA,
      }),
    ]);

    return {
      total,
      pagina: filtro.pagina,
      porPagina: DOCUMENTOS_POR_PAGINA,
      elementos: documentos.map((documento) => aResumen(documento, hoy)),
    };
  }

  async opciones(usuario: UsuarioAutenticado): Promise<OpcionesDocumentos> {
    const [tipos, clientes, areas] = await Promise.all([
      this.prisma.tipoDocumento.findMany({
        where: { activo: true },
        orderBy: { nombre: 'asc' },
        select: { id: true, nombre: true, admiteVencimiento: true },
      }),
      this.prisma.cliente.findMany({
        where: { AND: [this.accesoClientes.filtroVisible(usuario), { estado: { not: 'INACTIVO' } }] },
        orderBy: { razonSocial: 'asc' },
        select: { id: true, razonSocial: true },
      }),
      this.prisma.area.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
    ]);

    return {
      tipos,
      clientes,
      areas,
      puedeGestionar: usuario.permisos.has('documento:gestionar'),
      puedeRestringir: usuario.alcanceGlobal && usuario.permisos.has('documento:gestionar'),
    };
  }

  async detalle(id: string, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<DocumentoDetalle> {
    await this.acceso.obtenerVisible(id, usuario, contexto);
    const hoy = fechaHoyEnLima();
    const documento = await this.prisma.documento.findUniqueOrThrow({
      where: { id },
      include: {
        ...INCLUSION_RESUMEN,
        area: { select: { id: true, nombre: true } },
        creadoPor: { select: { id: true, nombre: true } },
      },
    });
    const versiones = await this.prisma.versionDocumento.findMany({
      where: { documentoId: id },
      orderBy: { numero: 'desc' },
      include: {
        cargadoPor: { select: { id: true, nombre: true } },
        archivo: { select: { id: true, nombreOriginal: true, mime: true, tamanoBytes: true } },
      },
    });
    const activo = documento.archivadoEn === null;

    return {
      ...aResumen(documento, hoy),
      area: documento.area,
      creadoPor: documento.creadoPor,
      creadoEn: aIso(documento.creadoEn),
      archivadoEn: aIsoONulo(documento.archivadoEn),
      motivoArchivo: documento.motivoArchivo,
      versiones: versiones.map((version) => ({
        id: version.id,
        numero: version.numero,
        nota: version.nota,
        cargadoPor: version.cargadoPor,
        cargadoEn: aIso(version.cargadoEn),
        archivo: {
          id: version.archivo.id,
          nombre: version.archivo.nombreOriginal,
          mime: version.archivo.mime,
          tamanoBytes: version.archivo.tamanoBytes,
        },
      })),
      puedeGestionar: activo && usuario.permisos.has('documento:gestionar'),
      puedeArchivar: activo && puedeArchivarDocumento(usuario, documento.creadoPorId),
    };
  }

  async expediente(clienteId: string, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<ExpedienteDocumental> {
    await this.accesoClientes.asegurarAcceso(usuario, clienteId, contexto);
    const hoy = fechaHoyEnLima();
    const [carpetas, esperados, archivos] = await Promise.all([
      this.carpetas.listar(clienteId, usuario),
      this.prisma.documentoEsperado.findMany({
        where: { clienteId, anuladoEn: null },
        orderBy: [{ periodo: 'desc' }, { fechaLimite: 'asc' }],
        include: {
          tipoDocumento: { select: { id: true, nombre: true } },
          documento: { select: { id: true, titulo: true } },
        },
      }),
      this.prisma.archivo.findMany({
        where: {
          clienteId,
          evidencias: { some: { avance: { tarea: this.accesoTareas.filtroVisible(usuario) } } },
        },
        orderBy: { subidoEn: 'desc' },
        take: MAXIMO_ARCHIVOS_DE_TAREAS,
        select: {
          id: true,
          nombreOriginal: true,
          mime: true,
          tamanoBytes: true,
          subidoEn: true,
          subidoPor: { select: { nombre: true } },
          constancias: { take: 1, select: { id: true } },
          evidencias: {
            take: 1,
            select: { avance: { select: { tarea: { select: { id: true, codigo: true, titulo: true } } } } },
          },
        },
      }),
    ]);

    return {
      clienteId,
      carpetas,
      esperados: esperados.map((esperado) => {
        const fechaLimite = aFechaIso(esperado.fechaLimite);
        const recibido = esperado.documentoId !== null;

        return {
          id: esperado.id,
          tipoDocumento: esperado.tipoDocumento,
          periodo: esperado.periodo,
          fechaLimite,
          descripcion: esperado.descripcion,
          estado: recibido ? 'RECIBIDO' : 'PENDIENTE',
          atrasado: !recibido && fechaLimite < hoy,
          documento: esperado.documento,
        };
      }),
      archivosDeTareas: archivos.flatMap((archivo) => {
        const tarea = archivo.evidencias[0]?.avance.tarea;

        return tarea === undefined
          ? []
          : [
              {
                archivo: { id: archivo.id, nombre: archivo.nombreOriginal, mime: archivo.mime, tamanoBytes: archivo.tamanoBytes },
                origen: archivo.constancias.length > 0 ? ('CONSTANCIA' as const) : ('EVIDENCIA' as const),
                tarea,
                subidoPor: archivo.subidoPor.nombre,
                subidoEn: aIso(archivo.subidoEn),
              },
            ];
      }),
      puedeGestionar: usuario.permisos.has('documento:gestionar'),
    };
  }

  async indicadores(usuario: UsuarioAutenticado): Promise<IndicadoresDocumentales> {
    const hoy = fechaHoyEnLima();
    const visibles: Prisma.DocumentoWhereInput = { AND: [filtroDocumentosVisibles(usuario), { archivadoEn: null }] };
    const [porVencer, vencidos, documentacionAtrasada] = await Promise.all([
      this.prisma.documento.count({
        where: { AND: [visibles, { fechaVencimiento: { gte: aFechaDb(hoy), lte: aFechaDb(sumarDias(hoy, DIAS_POR_VENCER)) } }] },
      }),
      this.prisma.documento.count({ where: { AND: [visibles, { fechaVencimiento: { lt: aFechaDb(hoy) } }] } }),
      this.prisma.documentoEsperado.count({
        where: {
          anuladoEn: null,
          documentoId: null,
          fechaLimite: { lt: aFechaDb(hoy) },
          cliente: this.accesoClientes.filtroVisible(usuario),
        },
      }),
    ]);

    return { porVencer, vencidos, documentacionAtrasada };
  }
}
