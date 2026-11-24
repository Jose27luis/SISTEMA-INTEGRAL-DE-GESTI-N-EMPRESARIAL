import { esquemaOpcionesFinanzas } from '@sige/types';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { fechaHoyEnLima } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { crearIngreso } from '../../actions';
import { FormularioIngreso } from '../../finance-forms';

export const metadata: Metadata = { title: 'Registrar ingreso · TORRES ASOCIADOS' };

export default async function PaginaNuevoIngreso({
  searchParams,
}: {
  searchParams: Promise<{ clienteId?: string | string[] }>;
}): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'finanza:ingresos')) {
    return <SinAcceso />;
  }

  const { clienteId } = await searchParams;
  const opciones = await solicitarApi('/finanzas/opciones', { esquema: esquemaOpcionesFinanzas });
  const inicial = (Array.isArray(clienteId) ? clienteId[0] : clienteId) ?? '';

  return (
    <>
      <EncabezadoPagina
        antetitulo="Ingresos y cobranza"
        titulo="Registrar ingreso"
        descripcion="Servicios adicionales o cobros puntuales. Los honorarios mensuales se generan solos desde la ficha comercial."
      />
      {opciones.ok ? (
        <Tarjeta className="max-w-3xl">
          <FormularioIngreso
            accion={crearIngreso}
            opciones={opciones.datos}
            clienteInicial={opciones.datos.clientes.some(({ id }) => id === inicial) ? inicial : ''}
            hoy={fechaHoyEnLima()}
          />
        </Tarjeta>
      ) : (
        <Alerta tono="error">{opciones.error.mensaje}</Alerta>
      )}
    </>
  );
}
