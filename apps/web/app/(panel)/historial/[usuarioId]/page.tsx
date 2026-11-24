import { esquemaHistorialTrabajador } from '@sige/types';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { Indicador } from '@/components/indicator-card';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { FiltroPeriodo } from '@/components/period-filter';
import { solicitarApi } from '@/lib/api';
import { fechaHoyEnLima, formatearFechaHora, formatearMinutos } from '@/lib/format';
import { leerRango } from '@/lib/periods';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { VistaLista } from '../../tareas/task-views';

export const metadata: Metadata = { title: 'Historial del trabajador · TORRES ASOCIADOS' };

interface PropiedadesPaginaHistorial {
  params: Promise<{ usuarioId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaHistorial({ params, searchParams }: PropiedadesPaginaHistorial): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'tarea:ver')) {
    return <SinAcceso />;
  }

  const { usuarioId } = await params;

  if (!z.uuid().safeParse(usuarioId).success) {
    notFound();
  }

  const rango = leerRango(await searchParams, fechaHoyEnLima());
  const resultado = await solicitarApi(
    `/historial/${usuarioId}?${new URLSearchParams({ desde: rango.desde, hasta: rango.hasta }).toString()}`,
    { esquema: esquemaHistorialTrabajador },
  );

  if (!resultado.ok) {
    if (resultado.estado === 404) {
      notFound();
    }

    return resultado.estado === 403 ? <SinAcceso /> : <Alerta tono="error">{resultado.error.mensaje}</Alerta>;
  }

  const historial = resultado.datos;
  const propio = usuarioId === perfil.usuario.id;
  const { indicadores } = historial;

  return (
    <>
      <EncabezadoPagina
        titulo={propio ? 'Mi historial' : `Historial de ${historial.usuario.nombre}`}
        descripcion={[historial.cargo, historial.area].filter((parte) => parte !== null).join(' · ') || 'Sin ficha de personal'}
      />
      <div className="flex flex-col gap-6">
        <Tarjeta>
          <FiltroPeriodo periodo={rango.periodo} desde={rango.desde} hasta={rango.hasta} />
        </Tarjeta>

        <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Indicador etiqueta="Recibidas" valor={indicadores.asignadas} detalle="Asignadas en el periodo" />
          <Indicador etiqueta="Ejecutadas" valor={indicadores.terminadas} detalle="Aprobadas o finalizadas" tono="exito" />
          <Indicador etiqueta="Aprobadas" valor={indicadores.aprobadas} detalle="Rondas de revisión" />
          <Indicador etiqueta="Observadas" valor={indicadores.observadas} detalle="Rondas de revisión" />
          <Indicador etiqueta="Abiertas" valor={indicadores.abiertas} />
          <Indicador
            etiqueta="Atrasadas"
            valor={indicadores.atrasadas}
            tono={indicadores.atrasadas > 0 ? 'alerta' : 'normal'}
          />
          <Indicador etiqueta="Tiempo registrado" valor={formatearMinutos(indicadores.minutos)} />
          <Indicador
            etiqueta="Cumplimiento"
            valor={indicadores.cumplimiento === null ? '—' : `${String(indicadores.cumplimiento)} %`}
            detalle="A tiempo, de lo que vencía"
          />
        </section>

        <Tarjeta titulo={`Tareas (${String(historial.tareas.length)})`} descripcion="Abiertas, y las que vencieron o se completaron en el periodo.">
          {historial.tareas.length === 0 ? (
            <p className="text-sm text-apagado">Sin tareas en el periodo.</p>
          ) : (
            <VistaLista tareas={historial.tareas} />
          )}
        </Tarjeta>

        <Tarjeta titulo={`Avances registrados (${String(historial.avances.length)})`}>
          {historial.avances.length === 0 ? (
            <p className="text-sm text-apagado">Sin avances en el periodo.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead className="border-b border-borde text-xs tracking-wide text-apagado uppercase">
                  <tr>
                    <th scope="col" className="py-3 pr-4 font-semibold">Fecha</th>
                    <th scope="col" className="py-3 pr-4 font-semibold">Tarea</th>
                    <th scope="col" className="py-3 pr-4 font-semibold">Actividad</th>
                    <th scope="col" className="py-3 pr-4 text-right font-semibold">Avance</th>
                    <th scope="col" className="py-3 pr-4 text-right font-semibold">Tiempo</th>
                    <th scope="col" className="py-3 pr-4 text-right font-semibold">Evidencias</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borde">
                  {historial.avances.map((avance) => (
                    <tr key={avance.id}>
                      <td className="py-3 pr-4 whitespace-nowrap">{formatearFechaHora(avance.registradoEn)}</td>
                      <td className="py-3 pr-4">
                        <Link href={`/tareas/${avance.tarea.id}`} className="font-semibold text-marino hover:underline">
                          {avance.tarea.codigo}
                        </Link>
                        <p className="text-xs text-apagado">{avance.tarea.titulo}</p>
                      </td>
                      <td className="py-3 pr-4">{avance.actividad}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{avance.porcentaje} %</td>
                      <td className="py-3 pr-4 text-right whitespace-nowrap">{formatearMinutos(avance.minutosDedicados)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{avance.evidencias}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
