import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import type { DocumentoEntrada, EdicionDocumento } from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService, type ClienteBaseDatos } from '../audit/audit.service';
import { AccesoClientesService } from '../clients/client-access.service';
import { detectarTipoArchivo, nombreSeguro, type TipoArchivo } from '../storage/file-signature';
import { AlmacenArchivos, type ArchivoGuardado } from '../storage/file-storage';
import { AccesoDocumentosService } from './document-access.service';
import { puedeArchivarDocumento } from './document-visibility';

export interface ArchivoDocumento {
  nombre: string;
  contenido: Buffer;
}

interface ArchivoPreparado {
  nombre: string;
  tipo: TipoArchivo;
  contenido: Buffer;
}

interface Clasificacion {
  tipoDocumentoId: string;
  carpetaId: string | null;
  areaId: string | null;
  periodo: string | null;
  fechaDocumento: string | null;
  fechaVencimiento: string | null;
  confidencialidad: DocumentoEntrada['confidencialidad'];
}

function errorCampo(campo: string, mensaje: string): BadRequestException {
  return new BadRequestException({ mensaje: 'Revise los datos ingresados.', errores: [{ campo, mensaje }] });
}

@Injectable()
export class GestionDocumentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly almacen: AlmacenArchivos,
    private readonly accesoClientes: AccesoClientesService,
    private readonly acceso: AccesoDocumentosService,
  ) {}

  async subir(
    entrada: DocumentoEntrada,
    archivos: readonly ArchivoDocumento[],
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<string> {
    if (entrada.clienteId !== null) {
      await this.accesoClientes.asegurarAcceso(usuario, entrada.clienteId, contexto);
    }

    await this.validar(entrada.clienteId, entrada, usuario, this.prisma);
    const preparado = this.preparar(archivos);
    const guardado = await this.almacen.guardar(
      preparado.contenido,
      entrada.clienteId === null ? 'documentos' : `clientes/${entrada.clienteId}`,
      preparado.tipo.extension,
    );

    return this.prisma.$transaction(async (tx) => {
      const archivo = await this.registrarArchivo(tx, preparado, guardado, entrada.clienteId, usuario.usuarioId);
      const documento = await tx.documento.create({
        data: {
          titulo: entrada.titulo,
          clienteId: entrada.clienteId,
          ...this.datosClasificacion(entrada),
          creadoPorId: usuario.usuarioId,
        },
      });

      await tx.versionDocumento.create({
        data: { documentoId: documento.id, numero: 1, archivoId: archivo, nota: entrada.nota, cargadoPorId: usuario.usuarioId },
      });

      const cumplidos = await this.cumplirEsperados(tx, documento.id, entrada.clienteId, entrada.tipoDocumentoId, entrada.periodo);

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'CREAR',
          entidad: 'documento',
          entidadId: documento.id,
          despues: { ...entrada, archivo: preparado.nombre, sha256: guardado.sha256, esperadosCumplidos: cumplidos },
        },
        tx,
      );

      return documento.id;
    });
  }

  async nuevaVersion(
    id: string,
    nota: string | null,
    archivos: readonly ArchivoDocumento[],
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const documento = await this.acceso.obtenerVisible(id, usuario, contexto);
    this.asegurarActivo(documento.archivadoEn);
    const preparado = this.preparar(archivos);
    const guardado = await this.almacen.guardar(
      preparado.contenido,
      documento.clienteId === null ? 'documentos' : `clientes/${documento.clienteId}`,
      preparado.tipo.extension,
    );

    await this.prisma.$transaction(async (tx) => {
      const numero = documento.versionActual + 1;
      const actualizado = await tx.documento.updateMany({
        where: { id, versionActual: documento.versionActual, archivadoEn: null },
        data: { versionActual: numero },
      });

      if (actualizado.count === 0) {
        throw new ConflictException({
          mensaje: 'Otra persona subió una versión mientras tanto. Recargue la página y vuelva a intentarlo.',
          errores: [],
        });
      }

      const archivo = await this.registrarArchivo(tx, preparado, guardado, documento.clienteId, usuario.usuarioId);
      await tx.versionDocumento.create({
        data: { documentoId: id, numero, archivoId: archivo, nota, cargadoPorId: usuario.usuarioId },
      });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'MODIFICAR',
          entidad: 'documento',
          entidadId: id,
          antes: { versionActual: documento.versionActual },
          despues: { versionActual: numero, archivo: preparado.nombre, sha256: guardado.sha256, nota },
          motivo: 'Nueva versión',
        },
        tx,
      );
    });
  }

  async editar(id: string, entrada: EdicionDocumento, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<void> {
    const documento = await this.acceso.obtenerVisible(id, usuario, contexto);
    this.asegurarActivo(documento.archivadoEn);
    await this.validar(documento.clienteId, entrada, usuario, this.prisma);
    const anterior = await this.prisma.documento.findUniqueOrThrow({ where: { id } });

    await this.prisma.$transaction(async (tx) => {
      await tx.documento.update({ where: { id }, data: { titulo: entrada.titulo, ...this.datosClasificacion(entrada) } });
      const cumplidos = await this.cumplirEsperados(tx, id, documento.clienteId, entrada.tipoDocumentoId, entrada.periodo);

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'MODIFICAR',
          entidad: 'documento',
          entidadId: id,
          antes: {
            titulo: anterior.titulo,
            tipoDocumentoId: anterior.tipoDocumentoId,
            carpetaId: anterior.carpetaId,
            areaId: anterior.areaId,
            periodo: anterior.periodo,
            fechaDocumento: anterior.fechaDocumento?.toISOString().slice(0, 10) ?? null,
            fechaVencimiento: anterior.fechaVencimiento?.toISOString().slice(0, 10) ?? null,
            confidencialidad: anterior.confidencialidad,
          },
          despues: { ...entrada, esperadosCumplidos: cumplidos },
        },
        tx,
      );
    });
  }

  async archivar(id: string, motivo: string, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<void> {
    const documento = await this.acceso.obtenerVisible(id, usuario, contexto);
    this.asegurarActivo(documento.archivadoEn);

    if (!puedeArchivarDocumento(usuario, documento.creadoPorId)) {
      throw new ForbiddenException({ mensaje: 'Solo quien subió el documento o Gerencia puede archivarlo.', errores: [] });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.documento.update({
        where: { id },
        data: { archivadoEn: new Date(), archivadoPorId: usuario.usuarioId, motivoArchivo: motivo },
      });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'ARCHIVAR',
          entidad: 'documento',
          entidadId: id,
          antes: { archivado: false },
          despues: { archivado: true },
          motivo,
        },
        tx,
      );
    });
  }

  private asegurarActivo(archivadoEn: Date | null): void {
    if (archivadoEn !== null) {
      throw new ConflictException({ mensaje: 'El documento está archivado y no admite cambios.', errores: [] });
    }
  }

  private preparar(archivos: readonly ArchivoDocumento[]): ArchivoPreparado {
    const [archivo, ...sobrantes] = archivos;

    if (archivo === undefined || sobrantes.length > 0) {
      throw errorCampo('archivo', 'Adjunte un archivo.');
    }

    const nombre = nombreSeguro(archivo.nombre);
    const tipo = detectarTipoArchivo(archivo.contenido, nombre);

    if (tipo === null) {
      throw errorCampo('archivo', 'Formato no permitido. Use PDF, imágenes (JPG, PNG, WEBP), Word, Excel o PowerPoint.');
    }

    return { nombre, tipo, contenido: archivo.contenido };
  }

  private async registrarArchivo(
    tx: ClienteBaseDatos,
    preparado: ArchivoPreparado,
    guardado: ArchivoGuardado,
    clienteId: string | null,
    usuarioId: string,
  ): Promise<string> {
    const archivo = await tx.archivo.create({
      data: {
        rutaAlmacen: guardado.ruta,
        nombreOriginal: preparado.nombre,
        mime: preparado.tipo.mime,
        tamanoBytes: guardado.tamanoBytes,
        sha256: guardado.sha256,
        clienteId,
        subidoPorId: usuarioId,
      },
    });

    return archivo.id;
  }

  private datosClasificacion(entrada: Clasificacion): {
    tipoDocumentoId: string;
    carpetaId: string | null;
    areaId: string | null;
    periodo: string | null;
    fechaDocumento: Date | null;
    fechaVencimiento: Date | null;
    confidencialidad: Clasificacion['confidencialidad'];
  } {
    return {
      tipoDocumentoId: entrada.tipoDocumentoId,
      carpetaId: entrada.carpetaId,
      areaId: entrada.areaId,
      periodo: entrada.periodo,
      fechaDocumento: entrada.fechaDocumento === null ? null : aFechaDb(entrada.fechaDocumento),
      fechaVencimiento: entrada.fechaVencimiento === null ? null : aFechaDb(entrada.fechaVencimiento),
      confidencialidad: entrada.confidencialidad,
    };
  }

  private async validar(
    clienteId: string | null,
    entrada: Clasificacion,
    usuario: UsuarioAutenticado,
    db: ClienteBaseDatos,
  ): Promise<void> {
    const tipo = await db.tipoDocumento.findUnique({ where: { id: entrada.tipoDocumentoId } });

    if (tipo?.activo !== true) {
      throw errorCampo('tipoDocumentoId', 'Seleccione un tipo de documento activo.');
    }

    if (entrada.fechaVencimiento !== null && !tipo.admiteVencimiento) {
      throw errorCampo('fechaVencimiento', `Los documentos de tipo «${tipo.nombre}» no llevan fecha de vencimiento.`);
    }

    if (entrada.carpetaId !== null) {
      const carpeta = clienteId === null ? 0 : await db.carpeta.count({ where: { id: entrada.carpetaId, clienteId } });

      if (carpeta === 0) {
        throw errorCampo('carpetaId', 'La carpeta no pertenece a este cliente.');
      }
    }

    if (entrada.areaId !== null) {
      const area = await db.area.findUnique({ where: { id: entrada.areaId }, select: { activo: true } });

      if (area?.activo !== true) {
        throw errorCampo('areaId', 'Seleccione un área activa.');
      }
    }

    if (entrada.confidencialidad === 'RESTRINGIDO' && !usuario.alcanceGlobal) {
      throw errorCampo('confidencialidad', 'Solo Gerencia puede restringir un documento.');
    }
  }

  private async cumplirEsperados(
    tx: ClienteBaseDatos,
    documentoId: string,
    clienteId: string | null,
    tipoDocumentoId: string,
    periodo: string | null,
  ): Promise<number> {
    if (clienteId === null || periodo === null) {
      return 0;
    }

    const cumplidos = await tx.documentoEsperado.updateMany({
      where: { clienteId, tipoDocumentoId, periodo, documentoId: null, anuladoEn: null },
      data: { documentoId, recibidoEn: new Date() },
    });

    return cumplidos.count;
  }
}
