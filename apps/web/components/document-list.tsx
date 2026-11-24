import type { DocumentoResumen } from '@sige/types';
import { Insignia } from '@sige/ui/components';
import { FileText } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatearFecha, formatearFechaHora, formatearTamano } from '@/lib/format';

export function InsigniaVencimiento({ documento }: { documento: DocumentoResumen }): ReactNode {
  if (documento.fechaVencimiento === null) {
    return null;
  }

  if (documento.vencido) {
    return <Insignia tono="peligro">Venció el {formatearFecha(documento.fechaVencimiento)}</Insignia>;
  }

  return (
    <Insignia tono={documento.porVencer ? 'aviso' : 'neutro'}>Vence el {formatearFecha(documento.fechaVencimiento)}</Insignia>
  );
}

export function ListaDocumentos({
  documentos,
  mostrarCliente,
  vacio,
}: {
  documentos: DocumentoResumen[];
  mostrarCliente: boolean;
  vacio: string;
}): ReactNode {
  if (documentos.length === 0) {
    return <p className="text-sm text-apagado">{vacio}</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-borde">
      {documentos.map((documento) => (
        <li key={documento.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
          <div className="flex min-w-0 items-start gap-3">
            <FileText aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-marino" />
            <div className="min-w-0">
              <Link href={`/documentos/${documento.id}`} className="font-semibold break-words text-marino hover:underline">
                {documento.titulo}
              </Link>
              <p className="text-sm text-tinta">
                {documento.tipoDocumento.nombre}
                {mostrarCliente ? ` · ${documento.cliente?.razonSocial ?? 'Documento interno'}` : ''}
                {documento.carpeta === null ? '' : ` · ${documento.carpeta.nombre}`}
                {documento.periodo === null ? '' : ` · ${documento.periodo}`}
              </p>
              <p className="text-xs text-apagado">
                Versión {documento.versionActual} · {documento.archivo.nombre} · {formatearTamano(documento.archivo.tamanoBytes)} ·
                Actualizado {formatearFechaHora(documento.actualizadoEn)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {documento.confidencialidad === 'RESTRINGIDO' ? <Insignia tono="info">Restringido</Insignia> : null}
            {documento.archivado ? <Insignia>Archivado</Insignia> : null}
            <InsigniaVencimiento documento={documento} />
            <a
              href={`/archivos/${documento.archivo.id}?descarga=1`}
              className="inline-flex min-h-9 items-center rounded-md px-2 text-sm font-semibold text-marino-claro hover:underline"
            >
              Descargar
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
