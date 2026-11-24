import {
  type CronogramaPeriodo,
  ETIQUETAS_GRUPO_CRONOGRAMA,
  esquemaGrupoCronograma,
  esquemaListaCronograma,
  esquemaTipoObligacion,
  PATRON_PERIODO,
} from '@sige/types';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { fechaHoyEnLima, formatearFecha, formatearFechaHora } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { guardarCronograma } from '../../obligaciones/actions';
import { FormularioCronograma } from './schedule-form';

export const metadata: Metadata = { title: 'Cronograma tributario · TORRES ASOCIADOS' };

type ParametrosBusqueda = Record<string, string | string[] | undefined>;

function primerValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? '';
}

function periodoAnterior(hoy: string): string {
  const [anio, mes] = hoy.split('-').map(Number);
  return new Date(Date.UTC(anio ?? 2000, (mes ?? 1) - 2, 1)).toISOString().slice(0, 7);
}

function periodosDelAnio(anio: number, hasta: string): string[] {
  return Array.from({ length: 12 }, (_, indice) => `${String(anio)}-${String(indice + 1).padStart(2, '0')}`).filter(
    (periodo) => periodo <= hasta,
  );
}

interface PropiedadesPaginaCronograma {
  searchParams: Promise<ParametrosBusqueda>;
}

export default async function PaginaCronograma({ searchParams }: PropiedadesPaginaCronograma): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'obligacion:ver')) {
    return <SinAcceso />;
  }

  const crudos = await searchParams;
  const hoy = fechaHoyEnLima();
  const anioCrudo = Number(primerValor(crudos.anio));
  const anio = Number.isInteger(anioCrudo) && anioCrudo >= 2020 && anioCrudo <= 2100 ? anioCrudo : Number(hoy.slice(0, 4));
  const puedeGestionar = tienePermiso(perfil, 'cronograma:gestionar');
  const [lista, tipos] = await Promise.all([
    solicitarApi(`/obligaciones/cronograma?anio=${String(anio)}`, { esquema: esquemaListaCronograma }),
    solicitarApi('/obligaciones/tipos', { esquema: esquemaTipoObligacion.array() }),
  ]);

  if (!lista.ok) {
    return <Alerta tono="error">{lista.error.mensaje}</Alerta>;
  }

  const tiposConCronograma = tipos.ok ? tipos.datos.filter((tipo) => tipo.activo && tipo.usaCronograma) : [];
  const cargados = new Set(
    lista.datos.cronogramas.map((cronograma) => `${cronograma.tipoObligacion.id}|${cronograma.periodo}|${cronograma.grupo}`),
  );
  const faltantes = periodosDelAnio(anio, periodoAnterior(hoy)).flatMap((periodo) =>
    tiposConCronograma
      .filter((tipo) => !cargados.has(`${tipo.id}|${periodo}|GENERAL`))
      .map((tipo) => `${tipo.codigo} ${periodo}`),
  );

  const [tipoEditar = '', periodoEditar = '', grupoEditar = ''] = primerValor(crudos.editar).split('|');
  const grupo = esquemaGrupoCronograma.safeParse(grupoEditar);
  const existente: CronogramaPeriodo | undefined = lista.datos.cronogramas.find(
    (cronograma) =>
      cronograma.tipoObligacion.id === tipoEditar &&
      cronograma.periodo === periodoEditar &&
      cronograma.grupo === grupoEditar,
  );
  const inicial = {
    tipoObligacionId: existente?.tipoObligacion.id ?? '',
    periodo: existente?.periodo ?? (PATRON_PERIODO.test(periodoEditar) ? periodoEditar : hoy.slice(0, 7)),
    grupo: existente?.grupo ?? (grupo.success ? grupo.data : 'GENERAL'),
    fuente: existente?.fuente ?? '',
    fechas: Object.fromEntries(
      (existente?.fechas ?? []).map(({ ultimoDigito, fechaVencimiento }) => [String(ultimoDigito), fechaVencimiento]),
    ),
  };

  return (
    <>
      <EncabezadoPagina
        titulo="Cronograma tributario"
        descripcion="Fechas de vencimiento publicadas por SUNAT, por periodo y último dígito del RUC. Se cargan a mano desde la fuente oficial."
        acciones={
          <div className="flex items-center gap-3 text-sm">
            <Link href={`/configuracion/cronograma?anio=${String(anio - 1)}`} className="font-semibold text-marino-claro hover:underline">
              ← {anio - 1}
            </Link>
            <span className="font-semibold text-marino">{anio}</span>
            <Link href={`/configuracion/cronograma?anio=${String(anio + 1)}`} className="font-semibold text-marino-claro hover:underline">
              {anio + 1} →
            </Link>
          </div>
        }
      />
      <div className="flex flex-col gap-6">
        {faltantes.length > 0 ? (
          <Alerta tono="aviso" titulo="Falta cargar el cronograma general">
            Sin estas fechas no se generan las obligaciones de esos periodos: {faltantes.slice(0, 12).join(', ')}
            {faltantes.length > 12 ? ` y ${String(faltantes.length - 12)} más` : ''}.
          </Alerta>
        ) : null}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Tarjeta titulo={`Cronogramas cargados de ${String(anio)}`}>
            {lista.datos.cronogramas.length === 0 ? (
              <p className="text-sm text-apagado">No hay cronogramas cargados para este año.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-borde">
                {lista.datos.cronogramas.map((cronograma) => (
                  <li
                    key={`${cronograma.tipoObligacion.id}-${cronograma.periodo}-${cronograma.grupo}`}
                    className="flex flex-col gap-2 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-tinta">
                          {cronograma.tipoObligacion.nombre} · {cronograma.periodo}
                        </p>
                        <p className="text-xs text-apagado">
                          {ETIQUETAS_GRUPO_CRONOGRAMA[cronograma.grupo]} · {cronograma.cargadoPor} ·{' '}
                          {formatearFechaHora(cronograma.actualizadoEn)}
                        </p>
                      </div>
                      {puedeGestionar ? (
                        <Link
                          href={`/configuracion/cronograma?anio=${String(anio)}&editar=${cronograma.tipoObligacion.id}|${cronograma.periodo}|${cronograma.grupo}#formulario-cronograma`}
                          className="text-sm font-semibold text-marino-claro hover:underline"
                        >
                          Editar
                        </Link>
                      ) : null}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-5">
                      {cronograma.fechas.map(({ ultimoDigito, fechaVencimiento }) => (
                        <div key={ultimoDigito} className="flex gap-1.5">
                          <dt className="font-semibold text-marino">{ultimoDigito}:</dt>
                          <dd className="text-tinta">{formatearFecha(fechaVencimiento)}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="text-xs break-words text-apagado">Fuente: {cronograma.fuente}</p>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
          {puedeGestionar ? (
            <div id="formulario-cronograma">
              <Tarjeta
                titulo={existente === undefined ? 'Cargar cronograma' : 'Editar cronograma'}
                descripcion="Copie las fechas tal como aparecen en el cronograma oficial del periodo."
              >
                {tiposConCronograma.length === 0 ? (
                  <p className="text-sm text-apagado">No hay tipos de obligación activos que usen el cronograma oficial.</p>
                ) : (
                  <FormularioCronograma
                    key={`${inicial.tipoObligacionId}-${inicial.periodo}-${inicial.grupo}`}
                    accion={guardarCronograma}
                    tipos={tiposConCronograma}
                    inicial={inicial}
                  />
                )}
              </Tarjeta>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
