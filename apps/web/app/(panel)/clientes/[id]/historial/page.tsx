import { esquemaRegistroHistorial } from '@sige/types';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { solicitarApi } from '@/lib/api';
import { formatearFechaHora } from '@/lib/format';

export const metadata: Metadata = { title: 'Historial del cliente · TORRES ASOCIADOS' };

const ETIQUETAS_ACCION: Partial<Record<string, string>> = {
  CREAR: 'Registro',
  MODIFICAR: 'Modificación',
  ACTIVAR: 'Activación',
  DESACTIVAR: 'Desactivación',
  PERMISO_DENEGADO: 'Acceso denegado',
  CAMBIAR_ESTADO: 'Cambio de estado',
  DESCARGAR: 'Descarga',
  ARCHIVAR: 'Archivo',
  CONSULTAR: 'Consulta',
  ANULAR: 'Anulación',
};

interface PropiedadesPaginaHistorial {
  params: Promise<{ id: string }>;
}

export default async function PaginaHistorial({ params }: PropiedadesPaginaHistorial): Promise<ReactNode> {
  const { id } = await params;
  const historial = await solicitarApi(`/clientes/${id}/historial`, { esquema: esquemaRegistroHistorial.array() });

  if (!historial.ok) {
    return <Alerta tono="error">{historial.error.mensaje}</Alerta>;
  }

  return (
    <Tarjeta titulo="Historial" descripcion="Cambios registrados en la auditoría para este cliente.">
      {historial.datos.length === 0 ? (
        <p className="text-sm text-apagado">Sin movimientos registrados.</p>
      ) : (
        <ol className="relative flex flex-col gap-5 border-l-2 border-borde pl-6">
          {historial.datos.map((registro) => (
            <li key={registro.id} className="relative">
              <span
                aria-hidden="true"
                className="absolute top-1.5 -left-[1.95rem] size-3 rounded-full border-2 border-superficie bg-dorado"
              />
              <p className="text-sm font-semibold text-tinta">
                {registro.motivo ?? ETIQUETAS_ACCION[registro.accion] ?? registro.accion}
              </p>
              <p className="text-xs text-apagado">
                {formatearFechaHora(registro.fecha)} · {registro.usuario ?? 'Sistema'}
              </p>
              {registro.despues === null ? null : (
                <details className="mt-1 text-xs">
                  <summary className="cursor-pointer font-medium text-marino-claro">Ver detalle</summary>
                  <pre className="mt-2 overflow-x-auto rounded-md bg-fondo p-3">
                    {JSON.stringify(registro.despues, null, 2)}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}
    </Tarjeta>
  );
}
