import { type EstadoTarea, ETIQUETAS_ESTADO_TAREA, type TareaResumen } from '@sige/types';
import { cn } from '@sige/ui/cn';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BarraAvance, EstadoTareaInsignia, PrioridadInsignia } from '@/components/task-badges';
import { TarjetaTarea } from '@/components/task-card';
import { formatearFecha } from '@/lib/format';

const COLUMNAS_TABLERO: EstadoTarea[] = ['PENDIENTE', 'EN_PROCESO', 'EN_REVISION', 'OBSERVADA', 'CORREGIDA'];
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function VistaLista({ tareas }: { tareas: TareaResumen[] }): ReactNode {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] text-left text-sm">
        <thead className="border-b border-borde text-xs tracking-wide text-apagado uppercase">
          <tr>
            <th scope="col" className="py-3 pr-4 font-semibold">Tarea</th>
            <th scope="col" className="py-3 pr-4 font-semibold">Responsable</th>
            <th scope="col" className="py-3 pr-4 font-semibold">Vence</th>
            <th scope="col" className="py-3 pr-4 font-semibold">Prioridad</th>
            <th scope="col" className="py-3 pr-4 font-semibold">Avance</th>
            <th scope="col" className="py-3 pr-4 font-semibold">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-borde">
          {tareas.map((tarea) => (
            <tr key={tarea.id}>
              <td className="py-3 pr-4">
                <Link href={`/tareas/${tarea.id}`} className="font-semibold text-marino hover:underline">
                  {tarea.titulo}
                </Link>
                <p className="text-xs text-apagado">
                  {tarea.codigo} · {tarea.cliente?.nombre ?? 'Interna'}
                </p>
              </td>
              <td className="py-3 pr-4">{tarea.responsable.nombre}</td>
              <td className={cn('py-3 pr-4 whitespace-nowrap', tarea.atrasada && 'font-semibold text-rojo')}>
                {formatearFecha(tarea.fechaLimite)}
                {tarea.atrasada ? <span className="block text-xs">Atrasada</span> : null}
              </td>
              <td className="py-3 pr-4">
                <PrioridadInsignia prioridad={tarea.prioridad} />
              </td>
              <td className="w-40 py-3 pr-4">
                <BarraAvance porcentaje={tarea.porcentajeAvance} />
              </td>
              <td className="py-3 pr-4">
                <EstadoTareaInsignia estado={tarea.estado} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function VistaTablero({ tareas }: { tareas: TareaResumen[] }): ReactNode {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="grid min-w-[70rem] grid-cols-5 gap-4">
        {COLUMNAS_TABLERO.map((estado) => {
          const columna = tareas.filter((tarea) => tarea.estado === estado);

          return (
            <section key={estado} aria-label={ETIQUETAS_ESTADO_TAREA[estado]} className="flex flex-col gap-3">
              <header className="flex items-center justify-between rounded-md bg-marino/5 px-3 py-2">
                <h2 className="text-sm font-semibold text-marino">{ETIQUETAS_ESTADO_TAREA[estado]}</h2>
                <span className="text-xs font-semibold text-apagado">{columna.length}</span>
              </header>
              {columna.length === 0 ? (
                <p className="rounded-md border border-dashed border-borde px-3 py-6 text-center text-xs text-apagado">
                  Sin tareas
                </p>
              ) : (
                columna.map((tarea) => <TarjetaTarea key={tarea.id} tarea={tarea} mostrarEstado={false} />)
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

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

interface PropiedadesCalendario {
  tareas: TareaResumen[];
  mes: string;
  hoy: string;
}

export function VistaCalendario({ tareas, mes, hoy }: PropiedadesCalendario): ReactNode {
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
          const delDia = tareas.filter((tarea) => tarea.fechaLimite === dia);
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
              {delDia.map((tarea) => (
                <Link
                  key={tarea.id}
                  href={`/tareas/${tarea.id}`}
                  title={`${tarea.codigo} · ${tarea.titulo}`}
                  className={cn(
                    'truncate rounded px-1.5 py-1 text-xs font-medium',
                    tarea.atrasada
                      ? 'bg-rojo/10 text-rojo'
                      : tarea.estado === 'FINALIZADA' || tarea.estado === 'APROBADA'
                        ? 'bg-verde/10 text-verde line-through'
                        : 'bg-marino/10 text-marino',
                  )}
                >
                  {tarea.titulo}
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
