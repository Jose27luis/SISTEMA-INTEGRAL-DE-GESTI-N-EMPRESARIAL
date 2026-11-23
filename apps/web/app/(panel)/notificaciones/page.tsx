import { esquemaPaginaNotificaciones } from '@sige/types';
import { cn } from '@sige/ui/cn';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { EncabezadoPagina } from '@/components/page-header';
import { BotonEnvio } from '@/components/submit-button';
import { solicitarApi } from '@/lib/api';
import { formatearFechaHora } from '@/lib/format';
import { marcarTodasLeidas } from './actions';

export const metadata: Metadata = { title: 'Notificaciones · TORRES ASOCIADOS' };

interface PropiedadesPaginaNotificaciones {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaNotificaciones({
  searchParams,
}: PropiedadesPaginaNotificaciones): Promise<ReactNode> {
  const { pagina: paginaCruda } = await searchParams;
  const pagina = Math.max(1, Math.floor(Number(Array.isArray(paginaCruda) ? paginaCruda[0] : paginaCruda) || 1));
  const resultado = await solicitarApi(`/notificaciones?pagina=${String(pagina)}`, {
    esquema: esquemaPaginaNotificaciones,
  });

  if (!resultado.ok) {
    return <Alerta tono="error">{resultado.error.mensaje}</Alerta>;
  }

  const { elementos, total, porPagina, noLeidas } = resultado.datos;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  return (
    <>
      <EncabezadoPagina
        titulo="Notificaciones"
        descripcion={noLeidas === 0 ? 'Está al día.' : `${String(noLeidas)} sin leer.`}
        acciones={
          noLeidas === 0 ? null : (
            <form action={marcarTodasLeidas}>
              <BotonEnvio variante="secundario" textoPendiente="Marcando…">
                Marcar todas como leídas
              </BotonEnvio>
            </form>
          )
        }
      />
      <Tarjeta>
        {elementos.length === 0 ? (
          <p className="text-sm text-apagado">No tiene notificaciones.</p>
        ) : (
          <ul className="divide-y divide-borde">
            {elementos.map((notificacion) => (
              <li key={notificacion.id}>
                <Link
                  href={notificacion.enlace}
                  className={cn(
                    '-mx-2 flex flex-col gap-0.5 rounded-md px-2 py-3 hover:bg-fondo',
                    !notificacion.leida && 'bg-dorado-suave/60',
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-marino">
                    {notificacion.leida ? null : (
                      <span aria-label="Sin leer" className="size-2 shrink-0 rounded-full bg-dorado-oscuro" />
                    )}
                    {notificacion.titulo}
                  </span>
                  <span className="text-sm text-apagado">{notificacion.mensaje}</span>
                  <span className="text-xs text-apagado">{formatearFechaHora(notificacion.creadoEn)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {totalPaginas > 1 ? (
          <nav aria-label="Paginación" className="mt-4 flex items-center justify-between gap-3 text-sm">
            {pagina > 1 ? (
              <Link href={`/notificaciones?pagina=${String(pagina - 1)}`} className="font-semibold text-marino-claro hover:underline">
                ← Recientes
              </Link>
            ) : (
              <span />
            )}
            <span className="text-apagado">
              Página {pagina} de {totalPaginas}
            </span>
            {pagina < totalPaginas ? (
              <Link href={`/notificaciones?pagina=${String(pagina + 1)}`} className="font-semibold text-marino-claro hover:underline">
                Anteriores →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </Tarjeta>
    </>
  );
}
