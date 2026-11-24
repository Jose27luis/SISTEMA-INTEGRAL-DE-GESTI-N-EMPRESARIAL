import {
  type ConteoTareas,
  esquemaOpcionesTarea,
  esquemaReporteActividades,
  esquemaReportePersonal,
} from '@sige/types';
import { cn } from '@sige/ui/cn';
import { Alerta, Tarjeta } from '@sige/ui/components';
import { FileSpreadsheet, FileText } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { FiltroPeriodo } from '@/components/period-filter';
import { solicitarApi } from '@/lib/api';
import { opcionesCatalogo } from '@/lib/catalog-options';
import { fechaHoyEnLima, formatearFecha, formatearMinutos } from '@/lib/format';
import { leerRango } from '@/lib/periods';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';

export const metadata: Metadata = { title: 'Reportes · TORRES ASOCIADOS' };

const TIPOS = [
  { clave: 'personal', etiqueta: 'Personal y cumplimiento' },
  { clave: 'actividades', etiqueta: 'Actividades por trabajador' },
] as const;

type TipoReporte = (typeof TIPOS)[number]['clave'];

function primerValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? '';
}

function CeldasConteo({ conteo }: { conteo: ConteoTareas }): ReactNode {
  return (
    <>
      <td className="py-2.5 pr-4 text-right tabular-nums">{conteo.asignadas}</td>
      <td className="py-2.5 pr-4 text-right tabular-nums">{conteo.terminadas}</td>
      <td className="py-2.5 pr-4 text-right tabular-nums">{conteo.aprobadas}</td>
      <td className="py-2.5 pr-4 text-right tabular-nums">{conteo.observadas}</td>
      <td className="py-2.5 pr-4 text-right tabular-nums">{conteo.abiertas}</td>
      <td className={cn('py-2.5 pr-4 text-right tabular-nums', conteo.atrasadas > 0 && 'font-semibold text-rojo')}>
        {conteo.atrasadas}
      </td>
      <td className="py-2.5 pr-4 text-right whitespace-nowrap">{formatearMinutos(conteo.minutos)}</td>
      <td className="py-2.5 pr-4 text-right tabular-nums">
        {conteo.cumplimiento === null ? '—' : `${String(conteo.cumplimiento)} %`}
      </td>
    </>
  );
}

const ENCABEZADOS_CONTEO = ['Asignadas', 'Terminadas', 'Aprobadas', 'Observadas', 'Abiertas', 'Atrasadas', 'Tiempo', 'Cumplimiento'];

interface PropiedadesPaginaReportes {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaReportes({ searchParams }: PropiedadesPaginaReportes): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'reporte:personal')) {
    return <SinAcceso />;
  }

  const crudos = await searchParams;
  const tipo: TipoReporte = primerValor(crudos.tipo) === 'actividades' ? 'actividades' : 'personal';
  const rango = leerRango(crudos, fechaHoyEnLima());
  const areaId = primerValor(crudos.areaId);
  const usuarioId = tipo === 'actividades' ? primerValor(crudos.usuarioId) : '';
  const consulta = new URLSearchParams({ desde: rango.desde, hasta: rango.hasta });

  if (areaId !== '') {
    consulta.set('areaId', areaId);
  }

  if (usuarioId !== '') {
    consulta.set('usuarioId', usuarioId);
  }

  const [areas, opciones, personal, actividades] = await Promise.all([
    opcionesCatalogo('areas'),
    solicitarApi('/tareas/opciones', { esquema: esquemaOpcionesTarea }),
    tipo === 'personal'
      ? solicitarApi(`/reportes/personal?${consulta.toString()}`, { esquema: esquemaReportePersonal })
      : Promise.resolve(null),
    tipo === 'actividades'
      ? solicitarApi(`/reportes/actividades?${consulta.toString()}`, { esquema: esquemaReporteActividades })
      : Promise.resolve(null),
  ]);
  const resultado = personal ?? actividades;
  const descarga = (formato: 'xlsx' | 'pdf'): string =>
    `/reportes/descarga?${new URLSearchParams({ ...Object.fromEntries(consulta), tipo, formato }).toString()}`;

  return (
    <>
      <EncabezadoPagina
        titulo="Reportes"
        descripcion="Se exportan con el logotipo, los filtros aplicados, su usuario y la fecha de generación."
        acciones={
          resultado?.ok === true ? (
            <div className="flex flex-wrap gap-2">
              <a
                href={descarga('xlsx')}
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-borde bg-superficie px-4 text-sm font-semibold text-marino hover:border-marino-claro"
              >
                <FileSpreadsheet aria-hidden="true" className="size-4" />
                Excel
              </a>
              <a
                href={descarga('pdf')}
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-marino px-4 text-sm font-semibold text-white hover:bg-marino-medio"
              >
                <FileText aria-hidden="true" className="size-4" />
                PDF
              </a>
            </div>
          ) : null
        }
      />
      <div className="flex flex-col gap-6">
        <nav aria-label="Tipo de reporte" className="inline-flex self-start rounded-md border border-borde bg-superficie p-1">
          {TIPOS.map(({ clave, etiqueta }) => (
            <Link
              key={clave}
              href={`/reportes?${new URLSearchParams({ tipo: clave, desde: rango.desde, hasta: rango.hasta }).toString()}`}
              aria-current={tipo === clave ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-9 items-center rounded px-3 text-sm font-semibold',
                tipo === clave ? 'bg-marino text-white' : 'text-marino hover:bg-marino/5',
              )}
            >
              {etiqueta}
            </Link>
          ))}
        </nav>

        <Tarjeta>
          <FiltroPeriodo
            periodo={rango.periodo}
            desde={rango.desde}
            hasta={rango.hasta}
            areas={areas}
            areaId={areaId}
            usuarios={tipo === 'actividades' && opciones.ok ? opciones.datos.usuarios : undefined}
            usuarioId={usuarioId}
            ocultos={{ tipo }}
          />
        </Tarjeta>

        {resultado === null ? null : !resultado.ok ? (
          <Alerta tono="error">{resultado.error.mensaje}</Alerta>
        ) : null}

        {personal?.ok === true ? (
          <>
            <Tarjeta titulo="Por trabajador" descripcion="Asignadas por fecha de creación; terminadas por fecha de aprobación o finalización; abiertas y atrasadas al día de hoy.">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[56rem] text-left text-sm">
                  <thead className="border-b border-borde text-xs tracking-wide text-apagado uppercase">
                    <tr>
                      <th scope="col" className="py-3 pr-4 font-semibold">Trabajador</th>
                      {ENCABEZADOS_CONTEO.map((titulo) => (
                        <th key={titulo} scope="col" className="py-3 pr-4 text-right font-semibold">
                          {titulo}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borde">
                    {personal.datos.personas.map((persona) => (
                      <tr key={persona.usuario.id}>
                        <td className="py-2.5 pr-4">
                          <Link
                            href={`/historial/${persona.usuario.id}?${new URLSearchParams({ desde: rango.desde, hasta: rango.hasta }).toString()}`}
                            className="font-semibold text-marino hover:underline"
                          >
                            {persona.usuario.nombre}
                          </Link>
                          <p className="text-xs text-apagado">{persona.area ?? 'Sin área'}</p>
                        </td>
                        <CeldasConteo conteo={persona} />
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-dorado font-semibold">
                    <tr>
                      <td className="py-2.5 pr-4">Total</td>
                      <CeldasConteo conteo={personal.datos.total} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Tarjeta>
            <Tarjeta titulo="Por área">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[56rem] text-left text-sm">
                  <thead className="border-b border-borde text-xs tracking-wide text-apagado uppercase">
                    <tr>
                      <th scope="col" className="py-3 pr-4 font-semibold">Área</th>
                      {ENCABEZADOS_CONTEO.map((titulo) => (
                        <th key={titulo} scope="col" className="py-3 pr-4 text-right font-semibold">
                          {titulo}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borde">
                    {personal.datos.areas.map((area) => (
                      <tr key={area.area}>
                        <td className="py-2.5 pr-4">
                          <span className="font-semibold text-tinta">{area.area}</span>
                          <p className="text-xs text-apagado">
                            {area.personas} {area.personas === 1 ? 'persona' : 'personas'}
                          </p>
                        </td>
                        <CeldasConteo conteo={area} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Tarjeta>
          </>
        ) : null}

        {actividades?.ok === true ? (
          <Tarjeta
            titulo={`${String(actividades.datos.filas.length)} avances · ${formatearMinutos(actividades.datos.totalMinutos)}`}
            descripcion="Use Hoy, Esta semana o Este mes para el reporte diario, semanal o mensual."
          >
            {actividades.datos.filas.length === 0 ? (
              <p className="text-sm text-apagado">Sin avances registrados en el periodo.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[56rem] text-left text-sm">
                  <thead className="border-b border-borde text-xs tracking-wide text-apagado uppercase">
                    <tr>
                      <th scope="col" className="py-3 pr-4 font-semibold">Fecha</th>
                      <th scope="col" className="py-3 pr-4 font-semibold">Trabajador</th>
                      <th scope="col" className="py-3 pr-4 font-semibold">Tarea</th>
                      <th scope="col" className="py-3 pr-4 font-semibold">Actividad</th>
                      <th scope="col" className="py-3 pr-4 text-right font-semibold">Avance</th>
                      <th scope="col" className="py-3 pr-4 text-right font-semibold">Minutos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borde">
                    {actividades.datos.filas.map((fila, indice) => (
                      <tr key={`${fila.fecha}-${fila.hora}-${String(indice)}`}>
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          {formatearFecha(fila.fecha)} {fila.hora}
                        </td>
                        <td className="py-2.5 pr-4">{fila.usuario}</td>
                        <td className="py-2.5 pr-4">
                          <span className="font-semibold text-marino">{fila.tareaCodigo}</span>
                          <p className="text-xs text-apagado">{fila.cliente ?? 'Interna'}</p>
                        </td>
                        <td className="py-2.5 pr-4">{fila.actividad}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">{fila.porcentaje} %</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">{fila.minutos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Tarjeta>
        ) : null}
      </div>
    </>
  );
}
