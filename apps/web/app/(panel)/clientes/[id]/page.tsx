import { ETIQUETAS_TIPO_PERSONA } from '@sige/types';
import { Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { obtenerCliente } from '@/lib/client-data';
import { fechaHoyEnLima, formatearFecha, formatearFechaHora } from '@/lib/format';
import { cambiarEstadoCliente, editarCliente } from '../actions';
import { FormularioCliente } from '../client-form';
import { cargarOpcionesCliente } from '../client-options';
import { FormularioEstadoCliente } from './status-form';

export const metadata: Metadata = { title: 'Cliente · TORRES ASOCIADOS' };

interface PropiedadesPaginaCliente {
  params: Promise<{ id: string }>;
}

export default async function PaginaCliente({ params }: PropiedadesPaginaCliente): Promise<ReactNode> {
  const { id } = await params;
  const resultado = await obtenerCliente(id);

  if (!resultado.ok) {
    return null;
  }

  const cliente = resultado.datos;

  if (!cliente.puedeGestionar) {
    return (
      <Tarjeta titulo="Datos generales">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <dt className="text-apagado">Tipo de persona</dt>
          <dd>{ETIQUETAS_TIPO_PERSONA[cliente.tipoPersona]}</dd>
          <dt className="text-apagado">RUC</dt>
          <dd>{cliente.ruc ?? 'No registrado'}</dd>
          <dt className="text-apagado">DNI</dt>
          <dd>{cliente.dni ?? 'No registrado'}</dd>
          <dt className="text-apagado">Domicilio fiscal</dt>
          <dd>{cliente.domicilioFiscal ?? 'No registrado'}</dd>
          <dt className="text-apagado">Representante legal</dt>
          <dd>{cliente.representanteLegal ?? 'No registrado'}</dd>
          <dt className="text-apagado">Actividad económica</dt>
          <dd>{cliente.actividadEconomica ?? 'No registrada'}</dd>
          <dt className="text-apagado">Régimen tributario</dt>
          <dd>{cliente.regimenTributario?.nombre ?? 'Sin definir'}</dd>
          <dt className="text-apagado">Responsable</dt>
          <dd>{cliente.responsable?.nombre ?? 'Sin responsable'}</dd>
          <dt className="text-apagado">Incorporación</dt>
          <dd>{formatearFecha(cliente.fechaIncorporacion)}</dd>
        </dl>
      </Tarjeta>
    );
  }

  const opciones = await cargarOpcionesCliente();

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Tarjeta titulo="Datos generales" descripcion={`Registrado el ${formatearFechaHora(cliente.creadoEn)}`}>
        <FormularioCliente
          accion={editarCliente.bind(null, cliente.id)}
          cliente={cliente}
          regimenes={opciones.regimenes}
          usuarios={opciones.usuarios}
          fechaHoy={fechaHoyEnLima()}
        />
      </Tarjeta>
      <Tarjeta titulo="Estado del cliente" descripcion="Los clientes no se eliminan: se suspenden o inactivan.">
        <FormularioEstadoCliente
          accion={cambiarEstadoCliente.bind(null, cliente.id)}
          estadoActual={cliente.estado}
        />
      </Tarjeta>
    </div>
  );
}
