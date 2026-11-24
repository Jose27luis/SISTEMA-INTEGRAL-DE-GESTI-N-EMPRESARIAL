import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DIAS_ALERTA_DOCUMENTACION, DIAS_ALERTA_DOCUMENTO } from '@sige/types';
import { aFechaDb, aFechaIso, fechaHoyEnLima, formatearFechaPeruana } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import type { ClienteBaseDatos } from '../audit/audit.service';
import { claveAvisoFecha, clasificarAvisoFecha, textoPlazo } from '../documents/document-alert-rules';
import { NotificacionesService } from '../notifications/notifications.service';

const PROCESO = 'alertas-de-documentos';
const CLAVE_BLOQUEO = 4_210_003;
const TIEMPO_MAXIMO_MS = 120_000;

function sumarDias(fecha: string, dias: number): string {
  const resultado = aFechaDb(fecha);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return aFechaIso(resultado);
}

@Injectable()
export class AlertasDocumentosJob implements OnApplicationBootstrap {
  private readonly registro = new Logger(AlertasDocumentosJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  onApplicationBootstrap(): void {
    void this.ejecutar();
  }

  @Cron('0 25 * * * *', { name: PROCESO, timeZone: 'America/Lima' })
  async ejecutar(): Promise<void> {
    const ejecucion = await this.prisma.ejecucionProceso.create({ data: { proceso: PROCESO } });

    try {
      const notificados = await this.prisma.$transaction(
        async (tx) => {
          const [bloqueo] = await tx.$queryRaw<{ tomado: boolean }[]>`SELECT pg_try_advisory_xact_lock(${CLAVE_BLOQUEO}) AS tomado`;

          if (bloqueo?.tomado !== true) {
            return null;
          }

          const hoy = fechaHoyEnLima();
          return [...(await this.avisarDocumentos(tx, hoy)), ...(await this.avisarDocumentacion(tx, hoy))];
        },
        { timeout: TIEMPO_MAXIMO_MS },
      );

      if (notificados !== null) {
        await this.notificaciones.publicar(notificados);
      }

      await this.prisma.ejecucionProceso.update({
        where: { id: ejecucion.id },
        data: {
          fin: new Date(),
          resultado: 'CORRECTO',
          registros: notificados?.length ?? 0,
          ...(notificados === null ? { error: 'Omitido: otra instancia tenía el bloqueo' } : {}),
        },
      });
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.registro.error(`Falló ${PROCESO}: ${mensaje}`);
      await this.prisma.ejecucionProceso.update({
        where: { id: ejecucion.id },
        data: { fin: new Date(), resultado: 'ERROR', error: mensaje.slice(0, 2000) },
      });
    }
  }

  private async avisarDocumentos(tx: ClienteBaseDatos, hoy: string): Promise<string[]> {
    const limite = sumarDias(hoy, Math.max(...DIAS_ALERTA_DOCUMENTO));
    const documentos = await tx.documento.findMany({
      where: { archivadoEn: null, fechaVencimiento: { not: null, lte: aFechaDb(limite) } },
      select: {
        id: true,
        titulo: true,
        fechaVencimiento: true,
        confidencialidad: true,
        creadoPorId: true,
        cliente: {
          select: {
            razonSocial: true,
            asignaciones: { where: { retiradoEn: null, rolEnCliente: 'RESPONSABLE' }, select: { usuarioId: true } },
          },
        },
      },
    });
    const avisados: string[] = [];

    for (const documento of documentos) {
      if (documento.fechaVencimiento === null) {
        continue;
      }

      const fecha = aFechaIso(documento.fechaVencimiento);
      const aviso = clasificarAvisoFecha(fecha, hoy, DIAS_ALERTA_DOCUMENTO);

      if (aviso === null) {
        continue;
      }

      const equipo =
        documento.confidencialidad === 'NORMAL' ? (documento.cliente?.asignaciones.map(({ usuarioId }) => usuarioId) ?? []) : [];
      const prefijo = aviso.tipo === 'VENCIDO' ? 'DOCUMENTO_VENCIDO' : 'DOCUMENTO_POR_VENCER';

      avisados.push(
        ...(await this.notificaciones.crear(
          {
            destinatarios: [documento.creadoPorId, ...equipo],
            tipo: prefijo,
            titulo: `Documento ${aviso.tipo === 'VENCIDO' ? 'vencido' : 'por vencer'}: ${documento.titulo}`,
            mensaje: `${documento.cliente?.razonSocial ?? 'Documento interno'} · ${textoPlazo(aviso)} el ${formatearFechaPeruana(fecha)}`,
            enlace: `/documentos/${documento.id}`,
            entidad: 'documento',
            entidadId: documento.id,
            claveDeduplicacion: (usuarioId) => claveAvisoFecha(prefijo, documento.id, fecha, aviso, usuarioId),
          },
          null,
          tx,
        )),
      );
    }

    return avisados;
  }

  private async avisarDocumentacion(tx: ClienteBaseDatos, hoy: string): Promise<string[]> {
    const limite = sumarDias(hoy, Math.max(...DIAS_ALERTA_DOCUMENTACION));
    const esperados = await tx.documentoEsperado.findMany({
      where: { anuladoEn: null, documentoId: null, fechaLimite: { lte: aFechaDb(limite) }, cliente: { estado: 'ACTIVO' } },
      select: {
        id: true,
        periodo: true,
        fechaLimite: true,
        creadoPorId: true,
        clienteId: true,
        tipoDocumento: { select: { nombre: true } },
        cliente: {
          select: {
            razonSocial: true,
            asignaciones: { where: { retiradoEn: null, rolEnCliente: 'RESPONSABLE' }, select: { usuarioId: true } },
          },
        },
      },
    });
    const avisados: string[] = [];

    for (const esperado of esperados) {
      const fecha = aFechaIso(esperado.fechaLimite);
      const aviso = clasificarAvisoFecha(fecha, hoy, DIAS_ALERTA_DOCUMENTACION);

      if (aviso === null) {
        continue;
      }

      avisados.push(
        ...(await this.notificaciones.crear(
          {
            destinatarios: [esperado.creadoPorId, ...esperado.cliente.asignaciones.map(({ usuarioId }) => usuarioId)],
            tipo: 'DOCUMENTACION_FALTANTE',
            titulo: `Documentación ${aviso.tipo === 'VENCIDO' ? 'no recibida' : 'pendiente'}: ${esperado.tipoDocumento.nombre}`,
            mensaje: `${esperado.cliente.razonSocial} · ${esperado.periodo} · el plazo ${textoPlazo(aviso)} el ${formatearFechaPeruana(fecha)}`,
            enlace: `/clientes/${esperado.clienteId}/documentos`,
            entidad: 'documento_esperado',
            entidadId: esperado.id,
            claveDeduplicacion: (usuarioId) => claveAvisoFecha('DOCUMENTACION_FALTANTE', esperado.id, fecha, aviso, usuarioId),
          },
          null,
          tx,
        )),
      );
    }

    return avisados;
  }
}
