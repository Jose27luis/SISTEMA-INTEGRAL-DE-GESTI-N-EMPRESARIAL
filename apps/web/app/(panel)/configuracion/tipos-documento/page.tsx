import { esquemaTipoDocumento } from '@sige/types';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { cambiarActivoTipoDocumento, guardarTipoDocumento } from '../../documentos/actions';
import { FilaTipoDocumento, FormularioTipoDocumento } from './document-type-forms';

export const metadata: Metadata = { title: 'Tipos de documento · TORRES ASOCIADOS' };

export default async function PaginaTiposDocumento(): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'catalogo:gestionar') || !tienePermiso(perfil, 'documento:ver')) {
    return <SinAcceso />;
  }

  const resultado = await solicitarApi('/documentos/tipos', { esquema: esquemaTipoDocumento.array() });

  return (
    <>
      <EncabezadoPagina titulo="Tipos de documento" descripcion="Clasificación de los documentos de los clientes y de la empresa." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Tarjeta titulo="Tipos registrados">
          {resultado.ok ? (
            <ul className="flex flex-col divide-y divide-borde">
              {resultado.datos.map((tipo) => (
                <FilaTipoDocumento
                  key={tipo.id}
                  tipo={tipo}
                  editar={guardarTipoDocumento.bind(null, tipo.id)}
                  cambiarActivo={cambiarActivoTipoDocumento.bind(null, tipo.id, !tipo.activo)}
                />
              ))}
            </ul>
          ) : (
            <Alerta tono="error">{resultado.error.mensaje}</Alerta>
          )}
        </Tarjeta>
        <Tarjeta titulo="Nuevo tipo">
          <FormularioTipoDocumento accion={guardarTipoDocumento.bind(null, null)} />
        </Tarjeta>
      </div>
    </>
  );
}
