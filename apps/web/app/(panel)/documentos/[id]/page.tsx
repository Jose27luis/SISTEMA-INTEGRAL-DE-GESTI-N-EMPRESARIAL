import { ETIQUETAS_CONFIDENCIALIDAD, esquemaDocumentoDetalle, esquemaExpedienteDocumental, esquemaOpcionesDocumentos } from '@sige/types';
import { Alerta, Insignia, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { FormularioConfirmacion } from '@/components/confirm-action-form';
import { FormularioDocumento, FormularioVersion } from '@/components/document-form';
import { InsigniaVencimiento } from '@/components/document-list';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { formatearFecha, formatearFechaHora, formatearTamano } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { archivarDocumento, editarDocumento, subirVersion } from '../actions';

export const metadata: Metadata = { title: 'Documento · TORRES ASOCIADOS' };

const TIPOS_CON_VISTA = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

interface PropiedadesPaginaDocumento {
  params: Promise<{ id: string }>;
}

export default async function PaginaDocumento({ params }: PropiedadesPaginaDocumento): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'documento:ver')) {
    return <SinAcceso />;
  }

  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const resultado = await solicitarApi(`/documentos/${id}`, { esquema: esquemaDocumentoDetalle });

  if (!resultado.ok) {
    if (resultado.estado === 404) {
      notFound();
    }

    return <Alerta tono={resultado.estado === 403 ? 'aviso' : 'error'}>{resultado.error.mensaje}</Alerta>;
  }

  const documento = resultado.datos;
  const [opciones, expediente] = await Promise.all([
    documento.puedeGestionar ? solicitarApi('/documentos/opciones', { esquema: esquemaOpcionesDocumentos }) : Promise.resolve(null),
    documento.puedeGestionar && documento.cliente !== null
      ? solicitarApi(`/documentos/clientes/${documento.cliente.id}`, { esquema: esquemaExpedienteDocumental })
      : Promise.resolve(null),
  ]);
  const carpetas = expediente?.ok === true ? expediente.datos.carpetas.map(({ id: carpetaId, ruta }) => ({ id: carpetaId, ruta })) : [];
  const volver = documento.cliente === null ? '/documentos' : `/clientes/${documento.cliente.id}/documentos`;

  return (
    <>
      <EncabezadoPagina
        antetitulo={
          <Link href={volver} className="text-sm font-medium text-marino-claro hover:underline">
            ← {documento.cliente === null ? 'Documentos' : documento.cliente.razonSocial}
          </Link>
        }
        titulo={documento.titulo}
        descripcion={`${documento.tipoDocumento.nombre} · Versión ${String(documento.versionActual)}`}
        acciones={
          <div className="flex flex-wrap items-center gap-1.5">
            {documento.archivado ? <Insignia>Archivado</Insignia> : null}
            <InsigniaVencimiento documento={documento} />
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          {documento.archivado ? (
            <Alerta tono="aviso" titulo="Documento archivado">
              Archivado el {formatearFechaHora(documento.archivadoEn ?? documento.actualizadoEn)}: {documento.motivoArchivo}
            </Alerta>
          ) : null}
          <Tarjeta titulo={`Versiones (${String(documento.versiones.length)})`} descripcion="Cada versión se conserva con quién y cuándo la subió.">
            <ul className="flex flex-col divide-y divide-borde">
              {documento.versiones.map((version) => (
                <li key={version.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-tinta">
                      Versión {version.numero}
                      {version.numero === documento.versionActual ? <Insignia tono="exito">Vigente</Insignia> : null}
                    </p>
                    <p className="text-sm break-words text-tinta">
                      {version.archivo.nombre} · {formatearTamano(version.archivo.tamanoBytes)}
                    </p>
                    <p className="text-xs text-apagado">
                      {version.cargadoPor.nombre} · {formatearFechaHora(version.cargadoEn)}
                    </p>
                    {version.nota === null ? null : <p className="mt-1 text-sm whitespace-pre-line text-tinta">{version.nota}</p>}
                  </div>
                  <div className="flex gap-1">
                    {TIPOS_CON_VISTA.has(version.archivo.mime) ? (
                      <a
                        href={`/archivos/${version.archivo.id}`}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex min-h-9 items-center rounded-md px-2 text-sm font-semibold text-marino-claro hover:underline"
                      >
                        Ver
                      </a>
                    ) : null}
                    <a
                      href={`/archivos/${version.archivo.id}?descarga=1`}
                      className="inline-flex min-h-9 items-center rounded-md px-2 text-sm font-semibold text-marino-claro hover:underline"
                    >
                      Descargar
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </Tarjeta>
          {documento.puedeGestionar ? (
            <Tarjeta titulo="Subir una nueva versión" descripcion="La versión anterior se conserva.">
              <FormularioVersion accion={subirVersion.bind(null, documento.id)} />
            </Tarjeta>
          ) : null}
          {documento.puedeGestionar && opciones?.ok === true ? (
            <Tarjeta titulo="Editar datos">
              <FormularioDocumento
                accion={editarDocumento.bind(null, documento.id)}
                opciones={opciones.datos}
                clienteFijo={documento.cliente?.id ?? null}
                carpetas={carpetas}
                documento={documento}
              />
            </Tarjeta>
          ) : null}
        </div>
        <div className="flex flex-col gap-6">
          <Tarjeta titulo="Datos">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
              <dt className="text-apagado">Cliente</dt>
              <dd>
                {documento.cliente === null ? (
                  'Documento interno'
                ) : (
                  <Link href={`/clientes/${documento.cliente.id}/documentos`} className="font-semibold text-marino-claro hover:underline">
                    {documento.cliente.razonSocial}
                  </Link>
                )}
              </dd>
              <dt className="text-apagado">Carpeta</dt>
              <dd>{documento.carpeta?.nombre ?? 'Sin carpeta'}</dd>
              <dt className="text-apagado">Área</dt>
              <dd>{documento.area?.nombre ?? 'Sin área'}</dd>
              <dt className="text-apagado">Periodo</dt>
              <dd>{documento.periodo ?? 'Sin periodo'}</dd>
              <dt className="text-apagado">Fecha</dt>
              <dd>{documento.fechaDocumento === null ? 'Sin fecha' : formatearFecha(documento.fechaDocumento)}</dd>
              <dt className="text-apagado">Vencimiento</dt>
              <dd>{documento.fechaVencimiento === null ? 'No vence' : formatearFecha(documento.fechaVencimiento)}</dd>
              <dt className="text-apagado">Acceso</dt>
              <dd>{ETIQUETAS_CONFIDENCIALIDAD[documento.confidencialidad]}</dd>
              <dt className="text-apagado">Subido por</dt>
              <dd>
                {documento.creadoPor.nombre} · {formatearFechaHora(documento.creadoEn)}
              </dd>
            </dl>
          </Tarjeta>
          {documento.puedeArchivar ? (
            <Tarjeta titulo="Archivar" descripcion="Un documento no se elimina: se archiva con sus versiones.">
              <FormularioConfirmacion
                accion={archivarDocumento.bind(null, documento.id, documento.cliente?.id ?? null)}
                etiquetaBoton="Archivar documento"
                textoPendiente="Archivando…"
                variante="peligro"
                pedirMotivo
                consecuencia="Deja de aparecer en las vistas normales; se puede consultar en el filtro de archivados."
              />
            </Tarjeta>
          ) : null}
        </div>
      </div>
    </>
  );
}
