import { esquemaTrabajadorResumen } from '@sige/types';
import { cn } from '@sige/ui/cn';
import { Alerta, Insignia, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { formatearFecha } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';

export const metadata: Metadata = { title: 'Personal · TORRES ASOCIADOS' };

const FILTROS = [
  { valor: 'ACTIVO', etiqueta: 'Activos' },
  { valor: 'INACTIVO', etiqueta: 'De baja' },
  { valor: '', etiqueta: 'Todos' },
] as const;

interface PropiedadesPaginaPersonal {
  searchParams: Promise<{ estado?: string | string[] }>;
}

export default async function PaginaPersonal({ searchParams }: PropiedadesPaginaPersonal): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'personal:ver')) {
    return <SinAcceso />;
  }

  const { estado: estadoCrudo } = await searchParams;
  const estado = FILTROS.find(({ valor }) => valor === (estadoCrudo ?? 'ACTIVO'))?.valor ?? 'ACTIVO';
  const personal = await solicitarApi(`/personal${estado === '' ? '' : `?estado=${estado}`}`, {
    esquema: esquemaTrabajadorResumen.array(),
  });

  return (
    <>
      <EncabezadoPagina
        titulo="Personal"
        descripcion="Fichas del personal y su cuenta de acceso."
        acciones={
          tienePermiso(perfil, 'personal:gestionar') ? (
            <Link
              href="/personal/nuevo"
              className="inline-flex min-h-11 items-center rounded-md bg-marino px-4 text-sm font-semibold text-white hover:bg-marino-medio"
            >
              Nuevo trabajador
            </Link>
          ) : null
        }
      />
      <nav aria-label="Estado" className="mb-4 flex flex-wrap gap-2">
        {FILTROS.map((filtro) => (
          <Link
            key={filtro.etiqueta}
            href={`/personal?estado=${filtro.valor}`}
            aria-current={filtro.valor === estado ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold',
              filtro.valor === estado
                ? 'border-marino bg-marino text-white'
                : 'border-borde bg-superficie text-marino hover:border-marino-claro',
            )}
          >
            {filtro.etiqueta}
          </Link>
        ))}
      </nav>
      {!personal.ok ? (
        <Alerta tono="error">{personal.error.mensaje}</Alerta>
      ) : personal.datos.length === 0 ? (
        <Tarjeta>
          <p className="text-sm text-apagado">No hay personal en esta lista.</p>
        </Tarjeta>
      ) : (
        <Tarjeta>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="border-b border-borde text-xs tracking-wide text-apagado uppercase">
                <tr>
                  <th scope="col" className="py-3 pr-4 font-semibold">Trabajador</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Cargo y área</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Incorporación</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {personal.datos.map((trabajador) => (
                  <tr key={trabajador.id}>
                    <td className="py-3 pr-4">
                      <Link href={`/personal/${trabajador.id}`} className="font-semibold text-marino hover:underline">
                        {trabajador.apellidos}, {trabajador.nombres}
                      </Link>
                      <p className="text-xs text-apagado">
                        DNI {trabajador.dni} · {trabajador.correo}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      {trabajador.cargo.nombre}
                      <p className="text-xs text-apagado">{trabajador.area.nombre}</p>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">{formatearFecha(trabajador.fechaIncorporacion)}</td>
                    <td className="py-3 pr-4">
                      {trabajador.estado === 'ACTIVO' ? (
                        <Insignia tono="exito">Activo</Insignia>
                      ) : (
                        <Insignia tono="peligro">De baja</Insignia>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}
    </>
  );
}
