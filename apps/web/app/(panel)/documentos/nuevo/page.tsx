import { esquemaOpcionesDocumentos } from '@sige/types';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { FormularioDocumento } from '@/components/document-form';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { subirDocumento } from '../actions';

export const metadata: Metadata = { title: 'Subir documento · TORRES ASOCIADOS' };

export default async function PaginaNuevoDocumento(): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'documento:gestionar')) {
    return <SinAcceso />;
  }

  const opciones = await solicitarApi('/documentos/opciones', { esquema: esquemaOpcionesDocumentos });

  return (
    <>
      <EncabezadoPagina
        antetitulo={
          <Link href="/documentos" className="text-sm font-medium text-marino-claro hover:underline">
            ← Documentos
          </Link>
        }
        titulo="Subir documento"
        descripcion="Para ubicarlo en una carpeta, súbalo desde la pestaña Documentos del cliente."
      />
      <div className="max-w-3xl">
        <Tarjeta>
          {opciones.ok ? (
            <FormularioDocumento accion={subirDocumento.bind(null, null)} opciones={opciones.datos} clienteFijo={null} carpetas={[]} />
          ) : (
            <Alerta tono="error">{opciones.error.mensaje}</Alerta>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
