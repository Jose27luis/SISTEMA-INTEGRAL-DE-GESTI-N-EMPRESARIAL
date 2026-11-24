import { ETIQUETAS_GRUPO_CRONOGRAMA, esquemaFichaTributaria, esquemaOpcionesObligaciones } from '@sige/types';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { solicitarApi } from '@/lib/api';
import { obtenerCliente } from '@/lib/client-data';
import { fechaHoyEnLima } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { cambiarGrupoCliente, desactivarObligacionCliente, guardarObligacionCliente } from '../../../obligaciones/actions';
import { FilaObligacion, FormularioGrupo, FormularioObligacion } from './obligation-forms';

export const metadata: Metadata = { title: 'Obligaciones del cliente · TORRES ASOCIADOS' };

interface PropiedadesPaginaObligacionesCliente {
  params: Promise<{ id: string }>;
}

function periodoAnterior(hoy: string): string {
  const [anio, mes] = hoy.split('-').map(Number);
  return new Date(Date.UTC(anio ?? 2000, (mes ?? 1) - 2, 1)).toISOString().slice(0, 7);
}

export default async function PaginaObligacionesCliente({
  params,
}: PropiedadesPaginaObligacionesCliente): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'obligacion:ver')) {
    return <SinAcceso />;
  }

  const { id } = await params;
  const [cliente, ficha, opciones] = await Promise.all([
    obtenerCliente(id),
    solicitarApi(`/obligaciones/clientes/${id}`, { esquema: esquemaFichaTributaria }),
    solicitarApi('/obligaciones/opciones', { esquema: esquemaOpcionesObligaciones }),
  ]);

  if (!cliente.ok) {
    return null;
  }

  if (!ficha.ok) {
    return <Alerta tono="error">{ficha.error.mensaje}</Alerta>;
  }

  const datos = ficha.datos;
  const tipos = opciones.ok ? opciones.datos.tipos : [];
  const equipo = cliente.datos.asignaciones.map(({ usuario }) => ({ id: usuario.id, nombre: usuario.nombre }));
  const activas = datos.obligaciones.filter(({ activo }) => activo);
  const inactivas = datos.obligaciones.filter(({ activo }) => !activo);
  const disponibles = tipos.filter((tipo) => !activas.some((activa) => activa.tipoObligacion.id === tipo.id));
  const periodoInicial = periodoAnterior(fechaHoyEnLima());

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        {datos.ruc === null ? (
          <Alerta tono="aviso" titulo="Cliente sin RUC">
            Las obligaciones que usan el cronograma oficial se calculan con el último dígito del RUC. Registre el RUC en la
            pestaña General para poder configurarlas.
          </Alerta>
        ) : null}
        <Tarjeta
          titulo="Obligaciones configuradas"
          descripcion="Cada periodo se genera una obligación con su vencimiento y una tarea para el responsable."
          acciones={
            <Link
              href={`/obligaciones?vista=lista&clienteId=${datos.clienteId}`}
              className="text-sm font-semibold text-marino-claro hover:underline"
            >
              Ver vencimientos →
            </Link>
          }
        >
          {activas.length === 0 ? (
            <p className="text-sm text-apagado">Este cliente no tiene obligaciones configuradas.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borde">
              {activas.map((obligacion) => (
                <FilaObligacion
                  key={obligacion.id}
                  obligacion={obligacion}
                  puedeGestionar={datos.puedeGestionar}
                  editar={guardarObligacionCliente.bind(null, datos.clienteId, obligacion.id)}
                  desactivar={desactivarObligacionCliente.bind(null, datos.clienteId, obligacion.id)}
                  tipos={tipos}
                  equipo={equipo}
                />
              ))}
            </ul>
          )}
        </Tarjeta>
        {inactivas.length > 0 ? (
          <Tarjeta titulo="Obligaciones desactivadas" descripcion="Se conservan con su historial; ya no se generan.">
            <ul className="flex flex-col divide-y divide-borde">
              {inactivas.map((obligacion) => (
                <li key={obligacion.id} className="py-3 text-sm">
                  <p className="font-semibold text-tinta">{obligacion.tipoObligacion.nombre}</p>
                  <p className="text-apagado">
                    Desde {obligacion.desdePeriodo}
                    {obligacion.hastaPeriodo === null ? '' : ` hasta ${obligacion.hastaPeriodo}`} · {obligacion.responsable.nombre}
                  </p>
                </li>
              ))}
            </ul>
          </Tarjeta>
        ) : null}
      </div>
      <div className="flex flex-col gap-6">
        {datos.puedeGestionar ? (
          <>
            <Tarjeta titulo="Configurar obligación">
              {equipo.length === 0 ? (
                <p className="text-sm text-apagado">
                  Primero asigne usuarios al cliente en la pestaña Equipo: el responsable y el revisor deben estar asignados.
                </p>
              ) : disponibles.length === 0 ? (
                <p className="text-sm text-apagado">Todas las obligaciones activas ya están configuradas.</p>
              ) : (
                <FormularioObligacion
                  accion={guardarObligacionCliente.bind(null, datos.clienteId, null)}
                  tipos={disponibles}
                  equipo={equipo}
                  periodoInicial={periodoInicial}
                />
              )}
            </Tarjeta>
            <Tarjeta titulo="Cronograma">
              <FormularioGrupo accion={cambiarGrupoCliente.bind(null, datos.clienteId)} grupo={datos.grupoCronograma} />
            </Tarjeta>
          </>
        ) : (
          <Tarjeta titulo="Cronograma">
            <p className="text-sm text-tinta">
              Grupo: <span className="font-semibold">{ETIQUETAS_GRUPO_CRONOGRAMA[datos.grupoCronograma]}</span>
            </p>
          </Tarjeta>
        )}
      </div>
    </div>
  );
}
