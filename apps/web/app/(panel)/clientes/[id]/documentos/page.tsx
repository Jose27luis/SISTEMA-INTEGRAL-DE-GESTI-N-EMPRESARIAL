import { esquemaExpedienteDocumental, esquemaOpcionesDocumentos, esquemaPaginaDocumentos } from '@sige/types';
import { cn } from '@sige/ui/cn';
import { Alerta, Insignia, Tarjeta } from '@sige/ui/components';
import { Folder } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { FormularioDocumento } from '@/components/document-form';
import { ListaDocumentos } from '@/components/document-list';
import { SinAcceso } from '@/components/no-access';
import { solicitarApi } from '@/lib/api';
import { fechaHoyEnLima, formatearFechaHora, formatearTamano } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { anularEsperado, crearCarpeta, registrarEsperado, renombrarCarpeta, subirDocumento } from '../../../documentos/actions';
import { FilaEsperado, FormularioCarpeta, FormularioEsperado, FormularioRenombrarCarpeta } from './document-forms';

export const metadata: Metadata = { title: 'Documentos del cliente · TORRES ASOCIADOS' };

interface PropiedadesPaginaDocumentosCliente {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function periodoAnterior(hoy: string): string {
  const [anio, mes] = hoy.split('-').map(Number);
  return new Date(Date.UTC(anio ?? 2000, (mes ?? 1) - 2, 1)).toISOString().slice(0, 7);
}

export default async function PaginaDocumentosCliente({
  params,
  searchParams,
}: PropiedadesPaginaDocumentosCliente): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'documento:ver')) {
    return <SinAcceso />;
  }

  const { id } = await params;
  const crudos = await searchParams;
  const carpetaCruda = Array.isArray(crudos.carpeta) ? crudos.carpeta[0] : crudos.carpeta;
  const carpetaId = z.uuid().safeParse(carpetaCruda).success ? (carpetaCruda ?? '') : '';
  const consulta = new URLSearchParams({ clienteId: id, ...(carpetaId === '' ? {} : { carpetaId }) });
  const [expediente, documentos, opciones] = await Promise.all([
    solicitarApi(`/documentos/clientes/${id}`, { esquema: esquemaExpedienteDocumental }),
    solicitarApi(`/documentos?${consulta.toString()}`, { esquema: esquemaPaginaDocumentos }),
    solicitarApi('/documentos/opciones', { esquema: esquemaOpcionesDocumentos }),
  ]);

  if (!expediente.ok) {
    return <Alerta tono="error">{expediente.error.mensaje}</Alerta>;
  }

  const datos = expediente.datos;
  const carpetaActual = datos.carpetas.find((carpeta) => carpeta.id === carpetaId);
  const opcionesCarpeta = datos.carpetas.map(({ id: idCarpeta, ruta }) => ({ id: idCarpeta, ruta }));
  const pendientes = datos.esperados.filter((esperado) => esperado.estado === 'PENDIENTE');
  const recibidos = datos.esperados.filter((esperado) => esperado.estado === 'RECIBIDO');

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        <Tarjeta titulo="Carpetas">
          {datos.carpetas.length === 0 ? (
            <p className="text-sm text-apagado">El expediente todavía no tiene carpetas.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              <li>
                <Link
                  href={`/clientes/${id}/documentos`}
                  aria-current={carpetaId === '' ? 'page' : undefined}
                  className={cn(
                    'flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-semibold',
                    carpetaId === '' ? 'bg-marino/10 text-marino' : 'text-tinta hover:bg-fondo',
                  )}
                >
                  <Folder aria-hidden="true" className="size-4" />
                  Todos los documentos
                </Link>
              </li>
              {datos.carpetas.map((carpeta) => (
                <li key={carpeta.id} className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/clientes/${id}/documentos?carpeta=${carpeta.id}`}
                    aria-current={carpetaId === carpeta.id ? 'page' : undefined}
                    className={cn(
                      'flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-sm',
                      carpetaId === carpeta.id ? 'bg-marino/10 font-semibold text-marino' : 'text-tinta hover:bg-fondo',
                    )}
                  >
                    <Folder aria-hidden="true" className="size-4 shrink-0" />
                    <span className="truncate">{carpeta.ruta}</span>
                    <span className="text-xs text-apagado">({carpeta.documentos})</span>
                  </Link>
                  {datos.puedeGestionar && carpetaId === carpeta.id ? (
                    <FormularioRenombrarCarpeta accion={renombrarCarpeta.bind(null, id, carpeta.id)} nombre={carpeta.nombre} />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta
          titulo={carpetaActual === undefined ? 'Documentos' : `Documentos en ${carpetaActual.ruta}`}
          acciones={
            <Link href={`/documentos?clienteId=${id}`} className="text-sm font-semibold text-marino-claro hover:underline">
              Buscar en todos →
            </Link>
          }
        >
          {documentos.ok ? (
            <>
              <ListaDocumentos documentos={documentos.datos.elementos} mostrarCliente={false} vacio="No hay documentos aquí." />
              {documentos.datos.total > documentos.datos.elementos.length ? (
                <p className="mt-3 text-sm text-apagado">
                  Se muestran los {documentos.datos.elementos.length} más recientes de {documentos.datos.total}. Use la búsqueda para ver el
                  resto.
                </p>
              ) : null}
            </>
          ) : (
            <Alerta tono="error">{documentos.error.mensaje}</Alerta>
          )}
        </Tarjeta>

        <Tarjeta
          titulo="Documentación esperada"
          descripcion="Lo que el cliente debe entregar en cada periodo. Se marca como recibido al subir un documento del mismo tipo y periodo."
        >
          {datos.esperados.length === 0 ? (
            <p className="text-sm text-apagado">No hay documentación esperada registrada.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borde">
              {[...pendientes, ...recibidos].map((esperado) => (
                <FilaEsperado
                  key={esperado.id}
                  esperado={esperado}
                  anular={datos.puedeGestionar ? anularEsperado.bind(null, id, esperado.id) : null}
                />
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta
          titulo="Evidencias y constancias de tareas"
          descripcion="Archivos adjuntados en los avances de las tareas del cliente, incluidas las constancias de obligaciones."
        >
          {datos.archivosDeTareas.length === 0 ? (
            <p className="text-sm text-apagado">Las tareas del cliente aún no tienen archivos adjuntos.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borde">
              {datos.archivosDeTareas.map((archivo) => (
                <li key={archivo.archivo.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium break-words text-tinta">
                      {archivo.archivo.nombre}
                      {archivo.origen === 'CONSTANCIA' ? <Insignia tono="info">Constancia</Insignia> : null}
                    </p>
                    <p className="text-xs text-apagado">
                      <Link href={`/tareas/${archivo.tarea.id}`} className="font-semibold text-marino-claro hover:underline">
                        {archivo.tarea.codigo}
                      </Link>{' '}
                      · {archivo.tarea.titulo} · {archivo.subidoPor} · {formatearFechaHora(archivo.subidoEn)} ·{' '}
                      {formatearTamano(archivo.archivo.tamanoBytes)}
                    </p>
                  </div>
                  <a
                    href={`/archivos/${archivo.archivo.id}?descarga=1`}
                    className="inline-flex min-h-9 items-center rounded-md px-2 text-sm font-semibold text-marino-claro hover:underline"
                  >
                    Descargar
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      {datos.puedeGestionar && opciones.ok ? (
        <div className="flex flex-col gap-6">
          <Tarjeta titulo="Subir documento">
            <FormularioDocumento
              accion={subirDocumento.bind(null, id)}
              opciones={opciones.datos}
              clienteFijo={id}
              carpetas={opcionesCarpeta}
              carpetaInicial={carpetaId}
            />
          </Tarjeta>
          <Tarjeta titulo="Nueva carpeta">
            <FormularioCarpeta accion={crearCarpeta.bind(null, id)} carpetas={opcionesCarpeta} padreInicial={carpetaId} />
          </Tarjeta>
          <Tarjeta titulo="Registrar documentación esperada">
            <FormularioEsperado
              accion={registrarEsperado.bind(null, id)}
              tipos={opciones.datos.tipos}
              periodoInicial={periodoAnterior(fechaHoyEnLima())}
            />
          </Tarjeta>
        </div>
      ) : null}
    </div>
  );
}
