import {
  ACCIONES_AUDITORIA,
  type AccionAuditoria,
  ETIQUETAS_ACCION_AUDITORIA,
  esquemaFiltroAuditoria,
  esquemaPaginaAuditoria,
  esquemaUsuarioResumen,
  type FiltroAuditoria,
} from '@sige/types';
import { Alerta, Campo, Insignia, Seleccion, Tarjeta, type TonoInsignia } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { formatearFechaHora } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';

export const metadata: Metadata = { title: 'Auditoría · TORRES ASOCIADOS' };

const TONOS_ACCION: Record<AccionAuditoria, TonoInsignia> = {
  CREAR: 'exito',
  MODIFICAR: 'info',
  ACTIVAR: 'exito',
  DESACTIVAR: 'peligro',
  INGRESAR: 'neutro',
  INGRESO_FALLIDO: 'aviso',
  SALIR: 'neutro',
  REVOCAR_SESION: 'aviso',
  PERMISO_DENEGADO: 'peligro',
  CAMBIAR_ESTADO: 'info',
  DESCARGAR: 'neutro',
  ARCHIVAR: 'aviso',
  CONSULTAR: 'neutro',
  ANULAR: 'peligro',
};

type ParametrosBusqueda = Record<string, string | string[] | undefined>;

function aConsulta(filtro: FiltroAuditoria, pagina: number): string {
  const consulta = new URLSearchParams();

  for (const [clave, valor] of Object.entries({ ...filtro, pagina: String(pagina) })) {
    if (typeof valor === 'string' && valor !== '') {
      consulta.set(clave, valor);
    }
  }

  return consulta.toString();
}

function primerValor(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

interface PropiedadesPaginaAuditoria {
  searchParams: Promise<ParametrosBusqueda>;
}

export default async function PaginaAuditoria({ searchParams }: PropiedadesPaginaAuditoria): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'auditoria:ver')) {
    return <SinAcceso />;
  }

  const crudos = await searchParams;
  const valores = {
    usuarioId: primerValor(crudos.usuarioId) ?? '',
    entidad: primerValor(crudos.entidad) ?? '',
    accion: primerValor(crudos.accion) ?? '',
    desde: primerValor(crudos.desde) ?? '',
    hasta: primerValor(crudos.hasta) ?? '',
    pagina: primerValor(crudos.pagina) ?? '1',
  };
  const filtro = esquemaFiltroAuditoria.safeParse(valores);

  const [registros, usuarios] = await Promise.all([
    filtro.success
      ? solicitarApi(`/auditoria?${aConsulta(filtro.data, filtro.data.pagina)}`, { esquema: esquemaPaginaAuditoria })
      : Promise.resolve(null),
    tienePermiso(perfil, 'usuario:ver')
      ? solicitarApi('/usuarios', { esquema: esquemaUsuarioResumen.array() })
      : Promise.resolve(null),
  ]);

  const totalPaginas =
    registros?.ok === true ? Math.max(1, Math.ceil(registros.datos.total / registros.datos.porPagina)) : 1;

  return (
    <>
      <EncabezadoPagina
        titulo="Auditoría"
        descripcion="Registro inalterable de quién hizo qué y cuándo. Ningún usuario puede modificarlo ni borrarlo."
      />
      <div className="flex flex-col gap-6">
        <Tarjeta titulo="Filtros">
          <form method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {usuarios?.ok === true ? (
              <Seleccion id="usuarioId" name="usuarioId" etiqueta="Usuario" defaultValue={valores.usuarioId}>
                <option value="">Todos</option>
                {usuarios.datos.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.nombre}
                  </option>
                ))}
              </Seleccion>
            ) : null}
            <Seleccion id="accion" name="accion" etiqueta="Acción" defaultValue={valores.accion}>
              <option value="">Todas</option>
              {ACCIONES_AUDITORIA.map((accion) => (
                <option key={accion} value={accion}>
                  {ETIQUETAS_ACCION_AUDITORIA[accion]}
                </option>
              ))}
            </Seleccion>
            <Campo
              id="entidad"
              name="entidad"
              etiqueta="Entidad"
              ayuda="Por ejemplo: usuario, rol, sesion, permiso."
              defaultValue={valores.entidad}
              maxLength={100}
            />
            <Campo id="desde" name="desde" type="date" etiqueta="Desde" defaultValue={valores.desde} />
            <Campo id="hasta" name="hasta" type="date" etiqueta="Hasta" defaultValue={valores.hasta} />
            <div className="flex items-end gap-3">
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-md bg-marino px-4 text-sm font-semibold text-white hover:bg-marino-medio"
              >
                Filtrar
              </button>
              <Link
                href="/auditoria"
                className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-marino-claro hover:bg-fondo"
              >
                Limpiar
              </Link>
            </div>
          </form>
        </Tarjeta>

        {!filtro.success ? (
          <Alerta tono="error">Los filtros no son válidos. Revise las fechas y vuelva a intentar.</Alerta>
        ) : registros === null ? null : !registros.ok ? (
          <Alerta tono="error">{registros.error.mensaje}</Alerta>
        ) : (
          <Tarjeta
            titulo={`${String(registros.datos.total)} ${registros.datos.total === 1 ? 'registro' : 'registros'}`}
          >
            {registros.datos.elementos.length === 0 ? (
              <p className="text-sm text-apagado">No hay registros con estos filtros.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-borde">
                {registros.datos.elementos.map((registro) => (
                  <li key={registro.id} className="flex flex-col gap-2 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Insignia tono={TONOS_ACCION[registro.accion]}>
                        {ETIQUETAS_ACCION_AUDITORIA[registro.accion]}
                      </Insignia>
                      <span className="font-medium text-tinta">{registro.usuario?.nombre ?? 'Sin usuario'}</span>
                      <span className="text-apagado">
                        {registro.entidad}
                        {registro.entidadId === null ? '' : ` · ${registro.entidadId}`}
                      </span>
                    </div>
                    <p className="text-xs text-apagado">
                      {formatearFechaHora(registro.fecha)} · IP {registro.ip ?? 'desconocida'}
                      {registro.motivo === null ? '' : ` · Motivo: ${registro.motivo}`}
                    </p>
                    {registro.antes === null && registro.despues === null ? null : (
                      <details className="text-xs">
                        <summary className="cursor-pointer font-medium text-marino-claro">Ver detalle</summary>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          {registro.antes === null ? null : (
                            <div>
                              <p className="mb-1 font-semibold text-apagado">Antes</p>
                              <pre className="overflow-x-auto rounded-md bg-fondo p-3">
                                {JSON.stringify(registro.antes, null, 2)}
                              </pre>
                            </div>
                          )}
                          {registro.despues === null ? null : (
                            <div>
                              <p className="mb-1 font-semibold text-apagado">Después</p>
                              <pre className="overflow-x-auto rounded-md bg-fondo p-3">
                                {JSON.stringify(registro.despues, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {totalPaginas > 1 ? (
              <nav aria-label="Paginación" className="mt-4 flex items-center justify-between gap-3 text-sm">
                {filtro.data.pagina > 1 ? (
                  <Link
                    href={`/auditoria?${aConsulta(filtro.data, filtro.data.pagina - 1)}`}
                    className="font-semibold text-marino-claro hover:underline"
                  >
                    ← Anteriores
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-apagado">
                  Página {filtro.data.pagina} de {totalPaginas}
                </span>
                {filtro.data.pagina < totalPaginas ? (
                  <Link
                    href={`/auditoria?${aConsulta(filtro.data, filtro.data.pagina + 1)}`}
                    className="font-semibold text-marino-claro hover:underline"
                  >
                    Siguientes →
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </Tarjeta>
        )}
      </div>
    </>
  );
}
