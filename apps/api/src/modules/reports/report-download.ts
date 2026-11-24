import type { FormatoExportacion } from '@sige/types';
import type { Response } from 'express';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { fechaHoyEnLima, horaEnLima } from '../../common/dates';
import { actorDesde, type AuditoriaService } from '../audit/audit.service';
import { exportarExcel, exportarPdf, type TablaExportable } from './report-exporter';

const TIPOS_CONTENIDO: Record<FormatoExportacion, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

export interface DescargaReporte {
  tabla: TablaExportable;
  nombre: string;
  formato: FormatoExportacion;
  detalles: Record<string, string | null>;
}

export function momentoDeGeneracion(): string {
  const [anio, mes, dia] = fechaHoyEnLima().split('-');
  return `${dia ?? ''}/${mes ?? ''}/${anio ?? ''} ${horaEnLima(new Date())}`;
}

export async function enviarReporte(
  auditoria: AuditoriaService,
  descarga: DescargaReporte,
  usuario: UsuarioAutenticado,
  cliente: ContextoCliente,
  respuesta: Response,
): Promise<void> {
  const { tabla, nombre, formato, detalles } = descarga;
  const contenido = formato === 'xlsx' ? await exportarExcel(tabla) : await exportarPdf(tabla);

  await auditoria.registrar({
    actor: actorDesde(usuario, cliente),
    accion: 'DESCARGAR',
    entidad: 'reporte',
    entidadId: null,
    despues: { reporte: tabla.titulo, formato, ...detalles, filas: tabla.filas.length },
  });

  respuesta.setHeader('Content-Type', TIPOS_CONTENIDO[formato]);
  respuesta.setHeader('Content-Disposition', `attachment; filename="${nombre}.${formato}"`);
  respuesta.setHeader('Cache-Control', 'private, no-store');
  respuesta.setHeader('X-Content-Type-Options', 'nosniff');
  respuesta.end(contenido);
}
