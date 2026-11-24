import {
  ESTADOS_OBLIGACION,
  ETIQUETAS_ESTADO_OBLIGACION,
  esquemaControlMensual,
  esquemaFiltroObligaciones,
  esquemaListaObligaciones,
  esquemaOpcionesObligaciones,
  PATRON_PERIODO,
} from '@sige/types';
import { cn } from '@sige/ui/cn';
import { Alerta, Seleccion, Tarjeta } from '@sige/ui/components';
import { CalendarDays, Grid3x3, List } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { fechaHoyEnLima } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { generarObligaciones } from './actions';
import { FormularioGeneracion } from './generation-form';
import { CalendarioObligaciones, ListaObligaciones, MatrizControl } from './obligation-views';

export const metadata: Metadata = { title: 'Obligaciones · TORRES ASOCIADOS' };

type ParametrosBusqueda = Record<string, string | string[] | undefined>;

const VISTAS = [
  { clave: 'calendario', etiqueta: 'Calendario', icono: CalendarDays },
  { clave: 'lista', etiqueta: 'Lista', icono: List },
  { clave: 'control', etiqueta: 'Control mensual', icono: Grid3x3 },
] as const;

type Vista = (typeof VISTAS)[number]['clave'];

const CAMPOS_FILTRO = ['clienteId', 'responsableId', 'tipoObligacionId', 'estado'] as const;

const NOMBRES_MES = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function primerValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? '';
}

function desplazarMes(mes: string, cantidad: number): string {
  const [anio, numero] = mes.split('-').map(Number);
  return new Date(Date.UTC(anio ?? 2000, (numero ?? 1) - 1 + cantidad, 1)).toISOString().slice(0, 7);
}

function nombreMes(mes: string): string {
  return NOMBRES_MES.format(new Date(`${mes}-01T00:00:00Z`));
}

interface PropiedadesPaginaObligaciones {
  searchParams: Promise<ParametrosBusqueda>;
}

export default async function PaginaObligaciones({ searchParams }: PropiedadesPaginaObligaciones): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'obligacion:ver')) {
    return <SinAcceso />;
  }

  const crudos = await searchParams;
  const vistaCruda = primerValor(crudos.vista);
  const vista: Vista = vistaCruda === 'lista' || vistaCruda === 'control' ? vistaCruda : 'calendario';
  const hoy = fechaHoyEnLima();
  const mesCrudo = primerValor(crudos.mes);
  const periodoCrudo = primerValor(crudos.periodo);
  const mes = PATRON_PERIODO.test(mesCrudo) ? mesCrudo : hoy.slice(0, 7);
  const periodo = PATRON_PERIODO.test(periodoCrudo) ? periodoCrudo : desplazarMes(hoy.slice(0, 7), -1);
  const valores: Record<(typeof CAMPOS_FILTRO)[number], string> = {
    clienteId: primerValor(crudos.clienteId),
    responsableId: primerValor(crudos.responsableId),
    tipoObligacionId: primerValor(crudos.tipoObligacionId),
    estado: primerValor(crudos.estado),
  };
  const consulta = new URLSearchParams();

  for (const campo of CAMPOS_FILTRO) {
    if (valores[campo] !== '') {
      consulta.set(campo, valores[campo]);
    }
  }

  const enlace = (cambios: Record<string, string>): string => {
    const destino = new URLSearchParams(consulta);
    destino.set('vista', vista);
    destino.set(vista === 'control' ? 'periodo' : 'mes', vista === 'control' ? periodo : mes);

    for (const [clave, valor] of Object.entries(cambios)) {
      destino.set(clave, valor);
    }

    return `/obligaciones?${destino.toString()}`;
  };

  const consultaApi = new URLSearchParams(consulta);
  consultaApi.set('mes', mes);
  const filtro = esquemaFiltroObligaciones.safeParse(Object.fromEntries(consultaApi));
  const [lista, control, opciones] = await Promise.all([
    vista !== 'control' && filtro.success
      ? solicitarApi(`/obligaciones?${consultaApi.toString()}`, { esquema: esquemaListaObligaciones })
      : Promise.resolve(null),
    vista === 'control'
      ? solicitarApi(`/obligaciones/control?periodo=${periodo}`, { esquema: esquemaControlMensual })
      : Promise.resolve(null),
    solicitarApi('/obligaciones/opciones', { esquema: esquemaOpcionesObligaciones }),
  ]);

  return (
    <>
      <EncabezadoPagina
        titulo="Obligaciones tributarias"
        descripcion={
          perfil.alcanceGlobal
            ? 'Vencimientos de todos los clientes según el cronograma oficial.'
            : 'Vencimientos de sus clientes asignados según el cronograma oficial.'
        }
      />
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Vistas" className="inline-flex rounded-md border border-borde bg-superficie p-1">
            {VISTAS.map(({ clave, etiqueta, icono: Icono }) => (
              <Link
                key={clave}
                href={`/obligaciones?${new URLSearchParams({ ...Object.fromEntries(consulta), vista: clave }).toString()}`}
                aria-current={vista === clave ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-9 items-center gap-2 rounded px-3 text-sm font-semibold',
                  vista === clave ? 'bg-marino text-white' : 'text-marino hover:bg-marino/5',
                )}
              >
                <Icono aria-hidden="true" className="size-4" />
                {etiqueta}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href={enlace(vista === 'control' ? { periodo: desplazarMes(periodo, -1) } : { mes: desplazarMes(mes, -1) })}
              className="font-semibold text-marino-claro hover:underline"
            >
              ← Anterior
            </Link>
            <span className="min-w-44 text-center font-semibold text-marino capitalize">
              {vista === 'control' ? `Periodo ${nombreMes(periodo)}` : `Vencen en ${nombreMes(mes)}`}
            </span>
            <Link
              href={enlace(vista === 'control' ? { periodo: desplazarMes(periodo, 1) } : { mes: desplazarMes(mes, 1) })}
              className="font-semibold text-marino-claro hover:underline"
            >
              Siguiente →
            </Link>
          </div>
        </div>

        {vista === 'control' ? (
          control?.ok === true ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {(['PENDIENTE', 'EN_PROCESO', 'PRESENTADA', 'OBSERVADA', 'CUMPLIDA'] as const).map((estado) => (
                  <div key={estado} className="rounded-lg border border-borde bg-superficie px-4 py-3">
                    <p className="text-xs font-semibold text-apagado uppercase">{ETIQUETAS_ESTADO_OBLIGACION[estado]}</p>
                    <p className="text-2xl font-bold text-marino">{control.datos.totales[estado]}</p>
                  </div>
                ))}
                <div className="rounded-lg border border-rojo/30 bg-rojo/5 px-4 py-3">
                  <p className="text-xs font-semibold text-rojo uppercase">Vencidas</p>
                  <p className="text-2xl font-bold text-rojo">{control.datos.vencidas}</p>
                </div>
              </div>
              {control.datos.sinGenerar > 0 ? (
                <Alerta tono="aviso">
                  {control.datos.sinGenerar}{' '}
                  {control.datos.sinGenerar === 1 ? 'obligación configurada no está generada' : 'obligaciones configuradas no están generadas'}{' '}
                  en este periodo. Revise que el cronograma esté cargado y genere el periodo.
                </Alerta>
              ) : null}
              <Tarjeta titulo={`Control del periodo ${control.datos.periodo}`}>
                <MatrizControl control={control.datos} />
              </Tarjeta>
              {control.datos.puedeGenerar ? (
                <Tarjeta titulo="Generar obligaciones">
                  <FormularioGeneracion accion={generarObligaciones} periodo={periodo} />
                </Tarjeta>
              ) : null}
            </>
          ) : (
            <Alerta tono="error">{control?.ok === false ? control.error.mensaje : 'No se pudo cargar el control.'}</Alerta>
          )
        ) : (
          <>
            <Tarjeta>
              <form method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <input type="hidden" name="vista" value={vista} />
                <input type="hidden" name="mes" value={mes} />
                <Seleccion id="clienteId" name="clienteId" etiqueta="Cliente" defaultValue={valores.clienteId}>
                  <option value="">Todos</option>
                  {opciones.ok
                    ? opciones.datos.clientes.map((cliente) => (
                        <option key={cliente.id} value={cliente.id}>
                          {cliente.razonSocial}
                        </option>
                      ))
                    : null}
                </Seleccion>
                <Seleccion
                  id="responsableId"
                  name="responsableId"
                  etiqueta="Responsable"
                  defaultValue={valores.responsableId}
                >
                  <option value="">Todos</option>
                  {opciones.ok
                    ? opciones.datos.responsables.map((responsable) => (
                        <option key={responsable.id} value={responsable.id}>
                          {responsable.nombre}
                        </option>
                      ))
                    : null}
                </Seleccion>
                <Seleccion
                  id="tipoObligacionId"
                  name="tipoObligacionId"
                  etiqueta="Tipo de obligación"
                  defaultValue={valores.tipoObligacionId}
                >
                  <option value="">Todos</option>
                  {opciones.ok
                    ? opciones.datos.tipos.map((tipo) => (
                        <option key={tipo.id} value={tipo.id}>
                          {tipo.nombre}
                        </option>
                      ))
                    : null}
                </Seleccion>
                <Seleccion id="estado" name="estado" etiqueta="Estado" defaultValue={valores.estado}>
                  <option value="">Todos</option>
                  {ESTADOS_OBLIGACION.map((estado) => (
                    <option key={estado} value={estado}>
                      {ETIQUETAS_ESTADO_OBLIGACION[estado]}
                    </option>
                  ))}
                </Seleccion>
                <div className="flex items-start gap-2 sm:mt-7">
                  <button
                    type="submit"
                    className="inline-flex min-h-11 items-center justify-center rounded-md bg-marino px-5 text-sm font-semibold text-white hover:bg-marino-medio"
                  >
                    Filtrar
                  </button>
                  <Link
                    href={`/obligaciones?vista=${vista}&mes=${mes}`}
                    className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-marino-claro hover:underline"
                  >
                    Limpiar
                  </Link>
                </div>
              </form>
            </Tarjeta>
            {lista === null ? (
              <Alerta tono="error">Los filtros no son válidos.</Alerta>
            ) : lista.ok ? (
              vista === 'calendario' ? (
                <CalendarioObligaciones obligaciones={lista.datos.obligaciones} mes={mes} hoy={hoy} />
              ) : (
                <Tarjeta titulo={`${String(lista.datos.obligaciones.length)} obligaciones vencen en ${nombreMes(mes)}`}>
                  <ListaObligaciones obligaciones={lista.datos.obligaciones} />
                </Tarjeta>
              )
            ) : (
              <Alerta tono="error">{lista.error.mensaje}</Alerta>
            )}
          </>
        )}
      </div>
    </>
  );
}
