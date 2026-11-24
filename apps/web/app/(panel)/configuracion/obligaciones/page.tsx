import { esquemaTipoObligacion } from '@sige/types';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { cambiarActivoTipo, guardarTipoObligacion } from '../../obligaciones/actions';
import { FilaTipoObligacion, FormularioTipoObligacion } from './obligation-type-forms';

export const metadata: Metadata = { title: 'Tipos de obligación · TORRES ASOCIADOS' };

export default async function PaginaTiposObligacion(): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'cronograma:gestionar')) {
    return <SinAcceso />;
  }

  const resultado = await solicitarApi('/obligaciones/tipos', { esquema: esquemaTipoObligacion.array() });

  return (
    <>
      <EncabezadoPagina
        titulo="Tipos de obligación"
        descripcion="Catálogo de obligaciones que se configuran en cada cliente y se generan cada periodo."
        acciones={
          <Link href="/configuracion/cronograma" className="text-sm font-semibold text-marino-claro hover:underline">
            Cronograma tributario →
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Tarjeta titulo="Tipos registrados">
          {resultado.ok ? (
            resultado.datos.length === 0 ? (
              <p className="text-sm text-apagado">No hay tipos de obligación registrados.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-borde">
                {resultado.datos.map((tipo) => (
                  <FilaTipoObligacion
                    key={tipo.id}
                    tipo={tipo}
                    editar={guardarTipoObligacion.bind(null, tipo.id)}
                    cambiarActivo={cambiarActivoTipo.bind(null, tipo.id, !tipo.activo)}
                  />
                ))}
              </ul>
            )
          ) : (
            <Alerta tono="error">{resultado.error.mensaje}</Alerta>
          )}
        </Tarjeta>
        <Tarjeta
          titulo="Nuevo tipo"
          descripcion="Los tipos con plazo interno vencen un día fijo del mes siguiente al periodo."
        >
          <FormularioTipoObligacion accion={guardarTipoObligacion.bind(null, null)} />
        </Tarjeta>
      </div>
    </>
  );
}
