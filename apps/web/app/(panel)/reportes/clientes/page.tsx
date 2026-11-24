import { esquemaReporteClientes, PATRON_PERIODO } from '@sige/types';
import { Alerta, Campo, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { fechaHoyEnLima } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';

export const metadata: Metadata = { title: 'Reporte de clientes · TORRES ASOCIADOS' };

interface PropiedadesPaginaReporteClientes {
  searchParams: Promise<{ periodo?: string | string[] }>;
}

function periodoAnterior(hoy: string): string {
  const [anio, mes] = hoy.split('-').map(Number);
  return new Date(Date.UTC(anio ?? 2000, (mes ?? 1) - 2, 1)).toISOString().slice(0, 7);
}

export default async function PaginaReporteClientes({ searchParams }: PropiedadesPaginaReporteClientes): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'reporte:clientes')) {
    return <SinAcceso />;
  }

  const { periodo: crudo } = await searchParams;
  const valor = (Array.isArray(crudo) ? crudo[0] : crudo) ?? '';
  const periodo = PATRON_PERIODO.test(valor) ? valor : periodoAnterior(fechaHoyEnLima());
  const resultado = await solicitarApi(`/reportes/clientes?periodo=${periodo}`, { esquema: esquemaReporteClientes });
  const descarga = (formato: 'xlsx' | 'pdf'): string =>
    `/reportes/descarga?${new URLSearchParams({ tipo: 'clientes', periodo, formato }).toString()}`;

  return (
    <>
      <EncabezadoPagina
        titulo="Reporte de clientes"
        descripcion="Estado, obligaciones del periodo, documentación faltante e incidencias abiertas de cada cliente."
        acciones={
          <div className="flex gap-2">
            <a
              href={descarga('xlsx')}
              className="inline-flex min-h-11 items-center rounded-md border border-borde bg-superficie px-4 text-sm font-semibold text-marino hover:border-marino-claro"
            >
              Excel
            </a>
            <a
              href={descarga('pdf')}
              className="inline-flex min-h-11 items-center rounded-md bg-marino px-4 text-sm font-semibold text-white hover:bg-marino-medio"
            >
              PDF
            </a>
          </div>
        }
      />
      <div className="flex flex-col gap-6">
        <Tarjeta>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="w-48">
              <Campo id="periodo" name="periodo" type="month" etiqueta="Periodo de obligaciones" defaultValue={periodo} />
            </div>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-md bg-marino px-5 text-sm font-semibold text-white hover:bg-marino-medio"
            >
              Ver
            </button>
          </form>
        </Tarjeta>
        {resultado.ok ? (
          <Tarjeta titulo={`${String(resultado.datos.filas.length)} clientes · periodo ${resultado.datos.periodo}`}>
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[48rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-borde text-left text-marino">
                    <th scope="col" className="py-2 pr-3 font-semibold">Cliente</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Estado</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Régimen</th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">Obligaciones</th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">Cumplidas</th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">Pendientes</th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">Vencidas</th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">Doc. faltante</th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">Incidencias</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.datos.filas.map((fila) => (
                    <tr key={`${fila.cliente}-${fila.documento ?? ''}`} className="border-b border-borde">
                      <th scope="row" className="py-2 pr-3 text-left font-medium text-tinta">
                        {fila.cliente}
                        {fila.documento === null ? null : <span className="block text-xs text-apagado">{fila.documento}</span>}
                      </th>
                      <td className="px-2 py-2">{fila.estado}</td>
                      <td className="px-2 py-2">{fila.regimen ?? 'Sin régimen'}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fila.obligacionesConfiguradas}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fila.cumplidas}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fila.pendientes}</td>
                      <td className={fila.vencidas > 0 ? 'px-2 py-2 text-right font-semibold text-rojo tabular-nums' : 'px-2 py-2 text-right tabular-nums'}>
                        {fila.vencidas}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{fila.documentacionFaltante}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fila.incidenciasAbiertas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>
        ) : (
          <Alerta tono="error">{resultado.error.mensaje}</Alerta>
        )}
      </div>
    </>
  );
}
