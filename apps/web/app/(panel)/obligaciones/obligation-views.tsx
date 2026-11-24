import { type ControlMensual, ETIQUETAS_ESTADO_OBLIGACION, type ObligacionResumen } from '@sige/types';
import { cn } from '@sige/ui/cn';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { EstadoObligacionInsignia } from '@/components/obligation-status';
import { formatearFecha } from '@/lib/format';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function diasDelMes(mes: string): string[] {
  const [anio, numeroMes] = mes.split('-').map(Number);
  const primero = new Date(Date.UTC(anio ?? 2000, (numeroMes ?? 1) - 1, 1));
  const desfase = (primero.getUTCDay() + 6) % 7;
  const inicio = new Date(primero);
  inicio.setUTCDate(inicio.getUTCDate() - desfase);
  const ultimo = new Date(Date.UTC(anio ?? 2000, numeroMes ?? 1, 0));
  const total = Math.ceil((desfase + ultimo.getUTCDate()) / 7) * 7;

  return Array.from({ length: total }, (_, indice) => {
    const dia = new Date(inicio);
    dia.setUTCDate(inicio.getUTCDate() + indice);
    return dia.toISOString().slice(0, 10);
  });
}

function claseEstado(obligacion: ObligacionResumen): string {
  if (obligacion.vencida) {
    return 'bg-rojo/10 text-rojo';
  }

  switch (obligacion.estado) {
    case 'CUMPLIDA':
      return 'bg-verde/10 text-verde line-through';
    case 'PRESENTADA':
      return 'bg-dorado/20 text-marino';
    case 'OBSERVADA':
      return 'bg-rojo/10 text-rojo';
    case 'ANULADA':
      return 'bg-fondo text-apagado line-through';
    default:
      return 'bg-marino/10 text-marino';
  }
}

export function CalendarioObligaciones({
  obligaciones,
  mes,
  hoy,
}: {
  obligaciones: ObligacionResumen[];
  mes: string;
  hoy: string;
}): ReactNode {
  const dias = diasDelMes(mes);

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="grid min-w-[52rem] grid-cols-7 overflow-hidden rounded-lg border border-borde">
        {DIAS_SEMANA.map((dia) => (
          <div key={dia} className="border-b border-borde bg-marino/5 px-2 py-2 text-center text-xs font-semibold text-marino">
            {dia}
          </div>
        ))}
        {dias.map((dia) => {
          const delDia = obligaciones.filter((obligacion) => obligacion.fechaVencimiento === dia);
          const fueraDeMes = !dia.startsWith(mes);

          return (
            <div
              key={dia}
              className={cn(
                'flex min-h-28 flex-col gap-1 border-r border-b border-borde p-1.5 [&:nth-child(7n)]:border-r-0',
                fueraDeMes && 'bg-fondo/60',
              )}
            >
              <span
                className={cn(
                  'self-end rounded-full px-1.5 text-xs font-semibold',
                  dia === hoy ? 'bg-dorado text-marino' : fueraDeMes ? 'text-apagado/60' : 'text-apagado',
                )}
              >
                {Number(dia.slice(8))}
              </span>
              {delDia.map((obligacion) => (
                <Link
                  key={obligacion.id}
                  href={`/obligaciones/${obligacion.id}`}
                  title={`${obligacion.tipoObligacion.nombre} ${obligacion.periodo} · ${obligacion.cliente.razonSocial} · ${ETIQUETAS_ESTADO_OBLIGACION[obligacion.estado]}`}
                  className={cn('truncate rounded px-1.5 py-1 text-xs font-medium', claseEstado(obligacion))}
                >
                  {obligacion.tipoObligacion.codigo} · {obligacion.cliente.razonSocial}
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ListaObligaciones({ obligaciones }: { obligaciones: ObligacionResumen[] }): ReactNode {
  if (obligaciones.length === 0) {
    return <p className="text-sm text-apagado">No hay obligaciones que venzan en este mes con los filtros elegidos.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-borde">
      {obligaciones.map((obligacion) => (
        <li key={obligacion.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <Link href={`/obligaciones/${obligacion.id}`} className="font-semibold text-marino hover:underline">
              {obligacion.tipoObligacion.nombre} · {obligacion.periodo}
            </Link>
            <p className="text-sm text-tinta">{obligacion.cliente.razonSocial}</p>
            <p className="text-xs text-apagado">
              Vence el {formatearFecha(obligacion.fechaVencimiento)} · {obligacion.responsable.nombre}
              {obligacion.fechaPresentacion === null
                ? ''
                : ` · Presentada el ${formatearFecha(obligacion.fechaPresentacion)}`}
            </p>
          </div>
          <EstadoObligacionInsignia estado={obligacion.estado} vencida={obligacion.vencida} />
        </li>
      ))}
    </ul>
  );
}

const CLASES_CELDA: Record<string, string> = {
  PENDIENTE: 'bg-fondo text-apagado',
  EN_PROCESO: 'bg-marino/10 text-marino',
  PRESENTADA: 'bg-dorado/25 text-marino',
  OBSERVADA: 'bg-rojo/10 text-rojo',
  CUMPLIDA: 'bg-verde/15 text-verde',
  ANULADA: 'bg-fondo text-apagado line-through',
};

export function MatrizControl({ control }: { control: ControlMensual }): ReactNode {
  if (control.filas.length === 0) {
    return (
      <p className="text-sm text-apagado">
        Ningún cliente tiene obligaciones configuradas para este periodo. Configúrelas en la pestaña Obligaciones de cada
        cliente.
      </p>
    );
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <caption className="sr-only">Control mensual de obligaciones del periodo {control.periodo}</caption>
        <thead>
          <tr className="border-b border-borde text-left">
            <th scope="col" className="py-2 pr-3 font-semibold text-marino">
              Cliente
            </th>
            {control.tipos.map((tipo) => (
              <th key={tipo.id} scope="col" title={tipo.nombre} className="px-2 py-2 text-center font-semibold text-marino">
                {tipo.codigo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {control.filas.map((fila) => (
            <tr key={fila.cliente.id} className="border-b border-borde">
              <th scope="row" className="py-2 pr-3 text-left font-medium text-tinta">
                <Link href={`/clientes/${fila.cliente.id}/obligaciones`} className="hover:underline">
                  {fila.cliente.razonSocial}
                </Link>
                {fila.cliente.ruc === null ? null : <span className="block text-xs text-apagado">RUC {fila.cliente.ruc}</span>}
              </th>
              {control.tipos.map((tipo) => {
                const celda = fila.celdas[tipo.id];

                if (!fila.configuradas.includes(tipo.id)) {
                  return (
                    <td key={tipo.id} className="px-2 py-2 text-center text-apagado/60">
                      <span aria-label="No aplica">·</span>
                    </td>
                  );
                }

                if (celda === null || celda === undefined) {
                  return (
                    <td key={tipo.id} className="px-2 py-2 text-center">
                      <span className="inline-block rounded px-2 py-1 text-xs font-semibold text-apagado ring-1 ring-borde ring-inset">
                        Sin generar
                      </span>
                    </td>
                  );
                }

                return (
                  <td key={tipo.id} className="px-2 py-2 text-center">
                    <Link
                      href={`/obligaciones/${celda.obligacionId}`}
                      title={`Vence el ${formatearFecha(celda.fechaVencimiento)}`}
                      className={cn(
                        'inline-block rounded px-2 py-1 text-xs font-semibold',
                        celda.vencida ? 'bg-rojo text-white' : CLASES_CELDA[celda.estado],
                      )}
                    >
                      {celda.vencida ? 'Vencida' : ETIQUETAS_ESTADO_OBLIGACION[celda.estado]}
                    </Link>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
