import {
  esquemaIndicadoresDocumentales,
  esquemaIndicadoresFinancieros,
  esquemaIndicadoresProyectos,
  esquemaIndicadoresTributarios,
  esquemaOpcionesTarea,
  esquemaTablero,
  type TareaResumen,
} from '@sige/types';
import { cn } from '@sige/ui/cn';
import { Alerta, Insignia, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Indicador } from '@/components/indicator-card';
import { EncabezadoPagina } from '@/components/page-header';
import { FiltroPeriodo } from '@/components/period-filter';
import { solicitarApi } from '@/lib/api';
import { opcionesCatalogo } from '@/lib/catalog-options';
import {
  fechaHoyEnLima,
  formatearFecha,
  formatearFechaHora,
  formatearMinutos,
  formatearMoneda,
  formatearPeriodo,
  formatearPlazo,
} from '@/lib/format';
import { navegacionPermitida } from '@/lib/navigation';
import { leerRango } from '@/lib/periods';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';

export const metadata: Metadata = { title: 'Inicio · TORRES ASOCIADOS' };

type ParametrosBusqueda = Record<string, string | string[] | undefined>;

function primerValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? '';
}

function ListaAlertas({ tareas, vacio }: { tareas: TareaResumen[]; vacio: string }): ReactNode {
  if (tareas.length === 0) {
    return <p className="text-sm text-apagado">{vacio}</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-borde">
      {tareas.map((tarea) => (
        <li key={tarea.id}>
          <Link href={`/tareas/${tarea.id}`} className="flex flex-col gap-0.5 py-2.5 hover:text-marino-claro">
            <span className="text-sm font-semibold text-marino">{tarea.titulo}</span>
            <span className={cn('text-xs', tarea.atrasada ? 'text-rojo' : 'text-apagado')}>
              {tarea.codigo} · {tarea.responsable.nombre} · Vence {formatearPlazo(tarea.fechaLimite, tarea.horaLimite)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AccesosDirectos({ rutas }: { rutas: { ruta: string; etiqueta: string }[] }): ReactNode {
  return (
    <Tarjeta titulo="Accesos directos">
      <ul className="flex flex-col divide-y divide-borde">
        {rutas.map((acceso) => (
          <li key={acceso.ruta}>
            <Link
              href={acceso.ruta}
              className="flex min-h-11 items-center justify-between text-sm font-medium text-marino hover:text-marino-claro"
            >
              {acceso.etiqueta}
              <span aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

interface PropiedadesPaginaInicio {
  searchParams: Promise<ParametrosBusqueda>;
}

export default async function PaginaInicio({ searchParams }: PropiedadesPaginaInicio): Promise<ReactNode> {
  const perfil = await obtenerPerfil();
  const accesos = navegacionPermitida(perfil.permisos)
    .flatMap(({ elementos }) => elementos)
    .filter(({ ruta }) => ruta !== '/inicio');
  const encabezado = (
    <EncabezadoPagina
      titulo={`Hola, ${perfil.usuario.nombre}`}
      descripcion={`Último ingreso: ${formatearFechaHora(perfil.usuario.ultimoIngreso)} · ${perfil.roles.map(({ nombre }) => nombre).join(' · ')}`}
    />
  );

  if (!tienePermiso(perfil, 'tarea:ver')) {
    return (
      <>
        {encabezado}
        <AccesosDirectos rutas={accesos} />
      </>
    );
  }

  const crudos = await searchParams;
  const rango = leerRango(crudos, fechaHoyEnLima());
  const verEquipo = tienePermiso(perfil, 'reporte:personal');
  const areaId = verEquipo ? primerValor(crudos.areaId) : '';
  const usuarioId = verEquipo ? primerValor(crudos.usuarioId) : '';
  const consulta = new URLSearchParams({ desde: rango.desde, hasta: rango.hasta });

  if (areaId !== '') {
    consulta.set('areaId', areaId);
  }

  if (usuarioId !== '') {
    consulta.set('usuarioId', usuarioId);
  }

  const [tablero, areas, opciones, tributario, documental, financiero, proyectos] = await Promise.all([
    solicitarApi(`/tablero?${consulta.toString()}`, { esquema: esquemaTablero }),
    verEquipo ? opcionesCatalogo('areas') : Promise.resolve(undefined),
    verEquipo ? solicitarApi('/tareas/opciones', { esquema: esquemaOpcionesTarea }) : Promise.resolve(null),
    tienePermiso(perfil, 'obligacion:ver')
      ? solicitarApi('/obligaciones/indicadores', { esquema: esquemaIndicadoresTributarios })
      : Promise.resolve(null),
    tienePermiso(perfil, 'documento:ver')
      ? solicitarApi('/documentos/indicadores', { esquema: esquemaIndicadoresDocumentales })
      : Promise.resolve(null),
    tienePermiso(perfil, 'finanza:ingresos')
      ? solicitarApi('/finanzas/indicadores', { esquema: esquemaIndicadoresFinancieros })
      : Promise.resolve(null),
    tienePermiso(perfil, 'proyecto:ver')
      ? solicitarApi('/proyectos/indicadores', { esquema: esquemaIndicadoresProyectos })
      : Promise.resolve(null),
  ]);

  const filtroTareas = new URLSearchParams();

  if (areaId !== '') {
    filtroTareas.set('areaId', areaId);
  }

  if (usuarioId !== '') {
    filtroTareas.set('responsableId', usuarioId);
  }

  const enlaceTareas = (extra: Record<string, string>): string =>
    `/tareas?${new URLSearchParams({ ...Object.fromEntries(filtroTareas), ...extra }).toString()}`;

  return (
    <>
      {encabezado}
      <div className="flex flex-col gap-6">
        <Tarjeta>
          <FiltroPeriodo
            periodo={rango.periodo}
            desde={rango.desde}
            hasta={rango.hasta}
            areas={areas}
            areaId={areaId}
            usuarios={opciones?.ok === true ? opciones.datos.usuarios : undefined}
            usuarioId={usuarioId}
          />
        </Tarjeta>

        {!tablero.ok ? (
          <Alerta tono="error">{tablero.error.mensaje}</Alerta>
        ) : (
          <>
            <section aria-label="Indicadores de actividades" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Indicador
                etiqueta="Asignadas"
                valor={tablero.datos.equipo.asignadas}
                detalle="Creadas en el periodo"
                enlace={enlaceTareas({})}
              />
              <Indicador
                etiqueta="Completadas"
                valor={tablero.datos.equipo.terminadas}
                detalle="Aprobadas o finalizadas"
                enlace={enlaceTareas({ estado: 'CERRADAS' })}
                tono="exito"
              />
              <Indicador
                etiqueta="Pendientes"
                valor={tablero.datos.equipo.abiertas}
                detalle="Abiertas hoy"
                enlace={enlaceTareas({ estado: 'ABIERTAS' })}
              />
              <Indicador
                etiqueta="Atrasadas"
                valor={tablero.datos.equipo.atrasadas}
                detalle="Fecha límite vencida"
                enlace={enlaceTareas({ atrasadas: 'si' })}
                tono={tablero.datos.equipo.atrasadas > 0 ? 'alerta' : 'normal'}
              />
              <Indicador
                etiqueta="Cumplimiento"
                valor={tablero.datos.equipo.cumplimiento === null ? '—' : `${String(tablero.datos.equipo.cumplimiento)} %`}
                detalle="A tiempo, de lo que vencía"
                {...(verEquipo ? { enlace: `/reportes?${consulta.toString()}` } : {})}
              />
              <Indicador
                etiqueta="Por revisar"
                valor={tablero.datos.equipo.porRevisar}
                detalle={perfil.alcanceGlobal ? 'En revisión' : 'Esperan su revisión'}
                enlace={tienePermiso(perfil, 'tarea:revisar') ? '/por-revisar' : enlaceTareas({ estado: 'EN_REVISION' })}
              />
            </section>

            {tablero.datos.clientes === null && tablero.datos.trabajadoresActivos === null ? null : (
              <section aria-label="Clientes y equipo" className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {tablero.datos.clientes === null ? null : (
                  <>
                    <Indicador
                      etiqueta="Clientes activos"
                      valor={tablero.datos.clientes.activos}
                      enlace="/clientes?estado=ACTIVO"
                    />
                    <Indicador
                      etiqueta="Clientes nuevos"
                      valor={tablero.datos.clientes.nuevos}
                      detalle="Incorporados en el periodo"
                      enlace="/clientes"
                    />
                  </>
                )}
                {tablero.datos.trabajadoresActivos === null ? null : (
                  <Indicador
                    etiqueta="Trabajadores activos"
                    valor={tablero.datos.trabajadoresActivos}
                    enlace="/personal?estado=ACTIVO"
                  />
                )}
                <Indicador
                  etiqueta="Tiempo registrado"
                  valor={formatearMinutos(tablero.datos.equipo.minutos)}
                  detalle="En avances del periodo"
                />
              </section>
            )}

            {financiero?.ok === true ? (
              <section aria-label="Indicadores financieros" className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Indicador
                  etiqueta="Facturado del mes"
                  valor={formatearMoneda(financiero.datos.facturadoMes)}
                  detalle={formatearPeriodo(financiero.datos.periodo)}
                  enlace={`/finanzas/ingresos?periodo=${financiero.datos.periodo}`}
                />
                <Indicador
                  etiqueta="Cobrado del mes"
                  valor={formatearMoneda(financiero.datos.cobradoMes)}
                  detalle="Cobros registrados"
                  tono="exito"
                />
                <Indicador
                  etiqueta="Por cobrar"
                  valor={formatearMoneda(financiero.datos.porCobrar)}
                  detalle="Saldo total pendiente"
                  enlace="/reportes/finanzas?vista=cobrar"
                />
                <Indicador
                  etiqueta="Vencido"
                  valor={formatearMoneda(financiero.datos.vencido)}
                  detalle={`${String(financiero.datos.clientesMorosos)} ${financiero.datos.clientesMorosos === 1 ? 'cliente' : 'clientes'} con atraso`}
                  enlace="/finanzas/ingresos?vencidos=si"
                  tono={financiero.datos.vencido > 0 ? 'alerta' : 'normal'}
                />
              </section>
            ) : null}

            {proyectos?.ok === true && (proyectos.datos.activos > 0 || proyectos.datos.finalizadosDelAnio > 0) ? (
              <section aria-label="Proyectos" className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="grid grid-cols-3 gap-3">
                  <Indicador etiqueta="Proyectos activos" valor={proyectos.datos.activos} enlace="/proyectos" />
                  <Indicador
                    etiqueta="Finalizados"
                    valor={proyectos.datos.finalizadosDelAnio}
                    detalle="En el año"
                    enlace="/proyectos?estado=FINALIZADO"
                    tono="exito"
                  />
                  <Indicador
                    etiqueta="Atrasados"
                    valor={proyectos.datos.atrasados}
                    detalle="Entrega vencida"
                    tono={proyectos.datos.atrasados > 0 ? 'alerta' : 'normal'}
                  />
                </div>
                <Tarjeta titulo="Proyectos con dificultades">
                  {proyectos.datos.conDificultades.length === 0 ? (
                    <p className="text-sm text-apagado">Ningún proyecto reporta dificultades.</p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-borde">
                      {proyectos.datos.conDificultades.map((proyecto) => (
                        <li key={proyecto.id} className="py-2 text-sm">
                          <Link href={`/proyectos/${proyecto.id}`} className="font-semibold text-marino hover:underline">
                            {proyecto.codigo} · {proyecto.nombre}
                          </Link>
                          <p className="text-xs text-rojo">{proyecto.detalleDificultad}</p>
                          <p className="text-xs text-apagado">
                            {proyecto.responsable.nombre} · {String(proyecto.avance)} % · entrega {formatearFecha(proyecto.fechaEntrega)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Tarjeta>
              </section>
            ) : null}

            {tributario?.ok === true ? (
              <section aria-label="Obligaciones tributarias" className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="grid grid-cols-2 gap-3">
                  <Indicador
                    etiqueta="Obligaciones por vencer"
                    valor={tributario.datos.porVencer}
                    detalle="En los próximos 7 días"
                    enlace="/obligaciones?vista=lista"
                  />
                  <Indicador
                    etiqueta="Obligaciones vencidas"
                    valor={tributario.datos.vencidas}
                    detalle="Sin presentación registrada"
                    enlace="/obligaciones?vista=control"
                    tono={tributario.datos.vencidas > 0 ? 'alerta' : 'normal'}
                  />
                  <Indicador
                    etiqueta="Presentadas"
                    valor={tributario.datos.presentadasDelMes}
                    detalle="Con constancia este mes"
                  />
                  <Indicador
                    etiqueta="Servicios cumplidos"
                    valor={tributario.datos.cumplidasDelMes}
                    detalle="Obligaciones cerradas este mes"
                    tono="exito"
                  />
                </div>
                <Tarjeta titulo="Próximos vencimientos tributarios">
                  {tributario.datos.proximas.length === 0 ? (
                    <p className="text-sm text-apagado">No hay obligaciones pendientes en los próximos 7 días.</p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-borde">
                      {tributario.datos.proximas.map((obligacion) => (
                        <li key={obligacion.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <Link href={`/obligaciones/${obligacion.id}`} className="min-w-0 truncate font-medium text-marino hover:underline">
                            {obligacion.tipoObligacion.codigo} · {obligacion.cliente.razonSocial}
                          </Link>
                          <span className={cn('shrink-0 text-xs font-semibold', obligacion.vencida ? 'text-rojo' : 'text-apagado')}>
                            {obligacion.vencida ? 'Venció' : 'Vence'} {formatearFecha(obligacion.fechaVencimiento)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Tarjeta>
              </section>
            ) : null}

            {documental?.ok === true ? (
              <section aria-label="Documentos" className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <Indicador
                  etiqueta="Documentos por vencer"
                  valor={documental.datos.porVencer}
                  detalle="En los próximos 30 días"
                  enlace="/documentos?vencimiento=por-vencer"
                  tono={documental.datos.porVencer > 0 ? 'alerta' : 'normal'}
                />
                <Indicador
                  etiqueta="Documentos vencidos"
                  valor={documental.datos.vencidos}
                  detalle="Licencias, poderes o contratos"
                  enlace="/documentos?vencimiento=vencidos"
                  tono={documental.datos.vencidos > 0 ? 'alerta' : 'normal'}
                />
                <Indicador
                  etiqueta="Documentación no recibida"
                  valor={documental.datos.documentacionAtrasada}
                  detalle="Esperada y con plazo vencido"
                  tono={documental.datos.documentacionAtrasada > 0 ? 'alerta' : 'normal'}
                />
              </section>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-3">
              <Tarjeta titulo={`Atrasadas (${String(tablero.datos.equipo.atrasadas)})`}>
                <ListaAlertas tareas={tablero.datos.alertas.atrasadas} vacio="No hay tareas atrasadas." />
              </Tarjeta>
              <Tarjeta titulo="Urgentes sin iniciar">
                <ListaAlertas tareas={tablero.datos.alertas.urgentesSinIniciar} vacio="No hay urgentes pendientes." />
              </Tarjeta>
              <Tarjeta titulo="Trabajos por revisar">
                <ListaAlertas tareas={tablero.datos.alertas.porRevisar} vacio="No hay trabajos en revisión." />
              </Tarjeta>
            </div>

            {tablero.datos.carga === null ? null : (
              <Tarjeta titulo="Carga y cumplimiento por trabajador" descripcion="Ordenado por atrasos y tareas abiertas.">
                {tablero.datos.carga.length === 0 ? (
                  <p className="text-sm text-apagado">Sin trabajadores para los filtros elegidos.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[48rem] text-left text-sm">
                      <thead className="border-b border-borde text-xs tracking-wide text-apagado uppercase">
                        <tr>
                          <th scope="col" className="py-3 pr-4 font-semibold">Trabajador</th>
                          <th scope="col" className="py-3 pr-4 text-right font-semibold">Abiertas</th>
                          <th scope="col" className="py-3 pr-4 text-right font-semibold">Atrasadas</th>
                          <th scope="col" className="py-3 pr-4 text-right font-semibold">Completadas</th>
                          <th scope="col" className="py-3 pr-4 text-right font-semibold">Observadas</th>
                          <th scope="col" className="py-3 pr-4 text-right font-semibold">Tiempo</th>
                          <th scope="col" className="py-3 pr-4 text-right font-semibold">Cumplimiento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-borde">
                        {tablero.datos.carga.map((persona) => (
                          <tr key={persona.usuario.id}>
                            <td className="py-3 pr-4">
                              <Link
                                href={`/historial/${persona.usuario.id}?${new URLSearchParams({ desde: rango.desde, hasta: rango.hasta }).toString()}`}
                                className="font-semibold text-marino hover:underline"
                              >
                                {persona.usuario.nombre}
                              </Link>
                              <p className="text-xs text-apagado">{persona.area ?? 'Sin área'}</p>
                            </td>
                            <td className="py-3 pr-4 text-right tabular-nums">{persona.abiertas}</td>
                            <td
                              className={cn(
                                'py-3 pr-4 text-right tabular-nums',
                                persona.atrasadas > 0 && 'font-semibold text-rojo',
                              )}
                            >
                              {persona.atrasadas}
                            </td>
                            <td className="py-3 pr-4 text-right tabular-nums">{persona.terminadas}</td>
                            <td className="py-3 pr-4 text-right tabular-nums">{persona.observadas}</td>
                            <td className="py-3 pr-4 text-right whitespace-nowrap">{formatearMinutos(persona.minutos)}</td>
                            <td className="py-3 pr-4 text-right">
                              {persona.cumplimiento === null ? (
                                <span className="text-apagado">—</span>
                              ) : (
                                <Insignia
                                  tono={persona.cumplimiento >= 90 ? 'exito' : persona.cumplimiento >= 70 ? 'aviso' : 'peligro'}
                                >
                                  {persona.cumplimiento} %
                                </Insignia>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Tarjeta>
            )}
          </>
        )}

        <AccesosDirectos rutas={accesos} />
      </div>
    </>
  );
}
