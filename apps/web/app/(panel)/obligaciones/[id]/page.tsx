import { ETIQUETAS_GRUPO_CRONOGRAMA, esquemaObligacionDetalle } from '@sige/types';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { SinAcceso } from '@/components/no-access';
import { EstadoObligacionInsignia } from '@/components/obligation-status';
import { EncabezadoPagina } from '@/components/page-header';
import { EstadoTareaInsignia } from '@/components/task-badges';
import { solicitarApi } from '@/lib/api';
import { fechaHoyEnLima, formatearFecha, formatearFechaHora, formatearTamano } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { presentarObligacion } from '../actions';
import { FormularioPresentacion } from './filing-form';

export const metadata: Metadata = { title: 'Obligación · TORRES ASOCIADOS' };

interface PropiedadesPaginaObligacion {
  params: Promise<{ id: string }>;
}

export default async function PaginaObligacion({ params }: PropiedadesPaginaObligacion): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'obligacion:ver')) {
    return <SinAcceso />;
  }

  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const resultado = await solicitarApi(`/obligaciones/${id}`, { esquema: esquemaObligacionDetalle });

  if (!resultado.ok) {
    if (resultado.estado === 404) {
      notFound();
    }

    return <Alerta tono={resultado.estado === 403 ? 'aviso' : 'error'}>{resultado.error.mensaje}</Alerta>;
  }

  const obligacion = resultado.datos;
  const esCorreccion = obligacion.estado === 'OBSERVADA';

  return (
    <>
      <EncabezadoPagina
        antetitulo={
          <Link href="/obligaciones" className="text-sm font-medium text-marino-claro hover:underline">
            ← Obligaciones
          </Link>
        }
        titulo={`${obligacion.tipoObligacion.nombre} · ${obligacion.periodo}`}
        descripcion={obligacion.cliente.razonSocial}
        acciones={<EstadoObligacionInsignia estado={obligacion.estado} vencida={obligacion.vencida} />}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          {obligacion.vencida ? (
            <Alerta tono="error" titulo="Obligación vencida">
              Venció el {formatearFecha(obligacion.fechaVencimiento)} y aún no se registra su presentación.
            </Alerta>
          ) : null}
          {esCorreccion ? (
            <Alerta tono="aviso" titulo="Observada por el revisor">
              Revise los comentarios en la tarea, corrija y registre nuevamente la presentación con su constancia.
            </Alerta>
          ) : null}
          {obligacion.puedePresentar ? (
            <Tarjeta
              titulo={esCorreccion ? 'Registrar la corrección' : 'Registrar la presentación'}
              descripcion={
                obligacion.revisor === null
                  ? 'Al registrarla, la obligación queda cumplida.'
                  : `Al registrarla, pasa a revisión de ${obligacion.revisor.nombre}.`
              }
            >
              <FormularioPresentacion
                accion={presentarObligacion.bind(null, obligacion.id)}
                fechaHoy={fechaHoyEnLima()}
                periodo={obligacion.periodo}
                esCorreccion={esCorreccion}
              />
            </Tarjeta>
          ) : null}
          <Tarjeta titulo="Presentación">
            {obligacion.fechaPresentacion === null ? (
              <p className="text-sm text-apagado">Todavía no se registra la presentación.</p>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
                <dt className="text-apagado">Fecha</dt>
                <dd>{formatearFecha(obligacion.fechaPresentacion)}</dd>
                <dt className="text-apagado">N.° de orden</dt>
                <dd>{obligacion.numeroOrden ?? 'No registrado'}</dd>
                <dt className="text-apagado">Constancia</dt>
                <dd>
                  {obligacion.constancia === null ? (
                    'Sin constancia'
                  ) : (
                    <a
                      href={`/archivos/${obligacion.constancia.id}`}
                      target="_blank"
                      rel="noopener"
                      className="font-semibold text-marino-claro hover:underline"
                    >
                      {obligacion.constancia.nombre} ({formatearTamano(obligacion.constancia.tamanoBytes)})
                    </a>
                  )}
                </dd>
                <dt className="text-apagado">Observaciones</dt>
                <dd className="whitespace-pre-line">{obligacion.observaciones ?? 'Sin observaciones'}</dd>
                <dt className="text-apagado">Aprobación</dt>
                <dd>
                  {obligacion.aprobacion === null
                    ? obligacion.revisor === null
                      ? 'No requiere revisión'
                      : 'Pendiente'
                    : `${obligacion.aprobacion.revisor} · ${formatearFechaHora(obligacion.aprobacion.fecha)}`}
                </dd>
              </dl>
            )}
          </Tarjeta>
        </div>
        <Tarjeta titulo="Datos">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
            <dt className="text-apagado">Cliente</dt>
            <dd>
              <Link href={`/clientes/${obligacion.cliente.id}/obligaciones`} className="font-semibold text-marino-claro hover:underline">
                {obligacion.cliente.razonSocial}
              </Link>
              {obligacion.cliente.ruc === null ? null : <span className="block text-xs text-apagado">RUC {obligacion.cliente.ruc}</span>}
            </dd>
            <dt className="text-apagado">Periodo</dt>
            <dd>{obligacion.periodo}</dd>
            <dt className="text-apagado">Vencimiento</dt>
            <dd>
              {formatearFecha(obligacion.fechaVencimiento)}
              <span className="block text-xs text-apagado">
                {obligacion.usaCronograma
                  ? `Cronograma oficial · ${ETIQUETAS_GRUPO_CRONOGRAMA[obligacion.grupoCronograma]}`
                  : 'Plazo interno del tipo de obligación'}
              </span>
            </dd>
            <dt className="text-apagado">Responsable</dt>
            <dd>{obligacion.responsable.nombre}</dd>
            <dt className="text-apagado">Revisor</dt>
            <dd>{obligacion.revisor?.nombre ?? 'Sin revisor'}</dd>
            <dt className="text-apagado">Tarea</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <Link href={`/tareas/${obligacion.tareaId}`} className="font-semibold text-marino-claro hover:underline">
                Ver tarea
              </Link>
              <EstadoTareaInsignia estado={obligacion.estadoTarea} />
            </dd>
            <dt className="text-apagado">Generada</dt>
            <dd>{formatearFechaHora(obligacion.generadaEn)}</dd>
          </dl>
        </Tarjeta>
      </div>
    </>
  );
}
