import { esquemaBusquedaEntrada, esquemaResultadosBusqueda, LARGO_MINIMO_BUSQUEDA } from '@sige/types';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';

export const metadata: Metadata = { title: 'Búsqueda · TORRES ASOCIADOS' };

interface PropiedadesPaginaBusqueda {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function PaginaBusqueda({ searchParams }: PropiedadesPaginaBusqueda): Promise<ReactNode> {
  const { q } = await searchParams;
  const consulta = (Array.isArray(q) ? q[0] : q)?.trim() ?? '';
  const entrada = esquemaBusquedaEntrada.safeParse({ q: consulta });

  if (!entrada.success) {
    return (
      <>
        <EncabezadoPagina titulo="Búsqueda" />
        <Alerta tono="info">Escriba al menos {LARGO_MINIMO_BUSQUEDA} caracteres en el buscador.</Alerta>
      </>
    );
  }

  const resultado = await solicitarApi(`/busqueda?${new URLSearchParams({ q: entrada.data.q }).toString()}`, {
    esquema: esquemaResultadosBusqueda,
  });

  if (!resultado.ok) {
    return <Alerta tono="error">{resultado.error.mensaje}</Alerta>;
  }

  const { clientes, tareas, documentos, proyectos } = resultado.datos;
  const total = clientes.length + tareas.length + documentos.length + proyectos.length;

  return (
    <>
      <EncabezadoPagina
        titulo={`Resultados para «${entrada.data.q}»`}
        descripcion={total === 0 ? 'Sin coincidencias dentro de lo que puede ver.' : 'Solo se muestra lo que tiene permitido ver.'}
      />
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        <Tarjeta titulo={`Clientes (${String(clientes.length)})`}>
          {clientes.length === 0 ? (
            <p className="text-sm text-apagado">Ninguno.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borde">
              {clientes.map((cliente) => (
                <li key={cliente.id} className="py-2 text-sm">
                  <Link href={`/clientes/${cliente.id}`} className="font-semibold text-marino hover:underline">
                    {cliente.razonSocial}
                  </Link>
                  {cliente.documento === null ? null : <p className="text-xs text-apagado">{cliente.documento}</p>}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
        <Tarjeta titulo={`Tareas (${String(tareas.length)})`}>
          {tareas.length === 0 ? (
            <p className="text-sm text-apagado">Ninguna.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borde">
              {tareas.map((tarea) => (
                <li key={tarea.id} className="py-2 text-sm">
                  <Link href={`/tareas/${tarea.id}`} className="font-semibold text-marino hover:underline">
                    {tarea.codigo} · {tarea.titulo}
                  </Link>
                  <p className="text-xs text-apagado">{tarea.cliente ?? 'Tarea interna'}</p>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
        <Tarjeta titulo={`Documentos (${String(documentos.length)})`}>
          {documentos.length === 0 ? (
            <p className="text-sm text-apagado">Ninguno.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borde">
              {documentos.map((documento) => (
                <li key={documento.id} className="py-2 text-sm">
                  <Link href={`/documentos/${documento.id}`} className="font-semibold text-marino hover:underline">
                    {documento.titulo}
                  </Link>
                  <p className="text-xs text-apagado">
                    {documento.tipo} · {documento.cliente ?? 'Documento interno'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
        <Tarjeta titulo={`Proyectos (${String(proyectos.length)})`}>
          {proyectos.length === 0 ? (
            <p className="text-sm text-apagado">Ninguno.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borde">
              {proyectos.map((proyecto) => (
                <li key={proyecto.id} className="py-2 text-sm">
                  <Link href={`/proyectos/${proyecto.id}`} className="font-semibold text-marino hover:underline">
                    {proyecto.codigo} · {proyecto.nombre}
                  </Link>
                  <p className="text-xs text-apagado">{proyecto.cliente ?? 'Proyecto interno'}</p>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
