import {
  DIAS_HABILES_SIN_REPORTE,
  ETIQUETAS_ETAPA_SEGUIMIENTO,
  ETIQUETAS_PRIORIDAD,
  ETIQUETAS_SEMAFORO,
  type PasoSeguimiento,
  type Prioridad,
  type SeguimientoTarea,
  type Semaforo,
} from '@sige/types';
import { cn } from '@sige/ui/cn';
import { Check, Minus, RotateCcw } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { formatearFecha, formatearFechaHora, formatearMinutos } from '@/lib/format';

const ESTILO_SEMAFORO: Record<Semaforo, { punto: string; texto: string; fondo: string }> = {
  A_TIEMPO: { punto: 'bg-verde', texto: 'text-verde-oscuro', fondo: 'bg-verde-suave' },
  POR_VENCER: { punto: 'bg-dorado', texto: 'text-dorado-oscuro', fondo: 'bg-dorado-suave' },
  VENCIDA: { punto: 'bg-rojo', texto: 'text-rojo', fondo: 'bg-rojo-suave' },
  CERRADA: { punto: 'bg-apagado', texto: 'text-apagado', fondo: 'bg-fondo' },
};

export function Semaforo({ semaforo, className }: { semaforo: Semaforo; className?: string }): ReactNode {
  const estilo = ESTILO_SEMAFORO[semaforo];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        estilo.fondo,
        estilo.texto,
        className,
      )}
    >
      <span aria-hidden="true" className={cn('size-2 rounded-full', estilo.punto, semaforo === 'VENCIDA' && 'animate-pulse')} />
      {ETIQUETAS_SEMAFORO[semaforo]}
    </span>
  );
}

function Marcador({ paso }: { paso: PasoSeguimiento }): ReactNode {
  switch (paso.situacion) {
    case 'HECHA':
      return (
        <span className="relative z-10 grid size-9 place-items-center rounded-full bg-verde text-superficie shadow-sm">
          <Check aria-hidden="true" className="size-5" strokeWidth={3} />
        </span>
      );
    case 'ACTUAL':
      return (
        <span className="relative z-10 grid size-9 place-items-center rounded-full bg-marino text-superficie shadow-md ring-4 ring-marino-claro/25">
          <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-marino-claro/30" />
          <span aria-hidden="true" className="size-2.5 rounded-full bg-superficie" />
        </span>
      );
    case 'OMITIDA':
      return (
        <span className="relative z-10 grid size-9 place-items-center rounded-full border-2 border-dashed border-borde bg-superficie text-apagado">
          <Minus aria-hidden="true" className="size-4" />
        </span>
      );
    case 'PENDIENTE':
      return <span className="relative z-10 size-9 rounded-full border-2 border-borde bg-superficie" />;
  }
}

const SITUACION_LEGIBLE: Record<PasoSeguimiento['situacion'], string> = {
  HECHA: 'completada',
  ACTUAL: 'etapa actual',
  OMITIDA: 'omitida',
  PENDIENTE: 'pendiente',
};

interface PropiedadesBarraSeguimiento {
  seguimiento: SeguimientoTarea;
  prioridad: Prioridad;
  fechaLimite: string;
}

export function BarraSeguimiento({ seguimiento, prioridad, fechaLimite }: PropiedadesBarraSeguimiento): ReactNode {
  const total = seguimiento.pasos.length;
  const alcanzado = seguimiento.pasos.findLastIndex(({ situacion }) => situacion !== 'PENDIENTE');
  const progreso = total <= 1 ? 100 : (Math.max(alcanzado, 0) / (total - 1)) * 100;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Semaforo semaforo={seguimiento.semaforo} />
        <span className="text-apagado">
          Vence el <span className="font-semibold text-tinta">{formatearFecha(fechaLimite)}</span>
        </span>
        {seguimiento.limiteReporte === null ? null : (
          <span className={cn(seguimiento.sinReporte ? 'font-semibold text-rojo' : 'text-apagado')}>
            Próximo reporte hasta el {formatearFecha(seguimiento.limiteReporte)}
          </span>
        )}
        {seguimiento.estricto ? (
          <span className="text-xs text-apagado">
            Prioridad {ETIQUETAS_PRIORIDAD[prioridad].toLowerCase()}: reporte cada {DIAS_HABILES_SIN_REPORTE[prioridad]}{' '}
            {DIAS_HABILES_SIN_REPORTE[prioridad] === 1 ? 'día hábil' : 'días hábiles'}
          </span>
        ) : null}
      </div>

      <ol aria-label="Etapas de la tarea" className="relative flex flex-col gap-0 sm:flex-row sm:items-start">
        <span aria-hidden="true" className="absolute top-[1.125rem] right-[calc(50%/var(--pasos))] left-[calc(50%/var(--pasos))] hidden h-1 rounded-full bg-borde sm:block" style={{ '--pasos': total } as CSSProperties} />
        <span
          aria-hidden="true"
          className="absolute top-[1.125rem] left-[calc(50%/var(--pasos))] hidden h-1 rounded-full bg-gradient-to-r from-verde to-marino-claro transition-all sm:block"
          style={{ '--pasos': total, width: `calc((100% - 100%/var(--pasos)) * ${String(progreso / 100)})` } as CSSProperties}
        />
        {seguimiento.pasos.map((paso, indice) => (
          <li
            key={paso.etapa}
            aria-current={paso.situacion === 'ACTUAL' ? 'step' : undefined}
            className="relative flex gap-3 pb-5 last:pb-0 sm:flex-1 sm:flex-col sm:items-center sm:gap-2 sm:pb-0 sm:text-center"
          >
            {indice < total - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-9 bottom-0 left-[1.0625rem] w-0.5 sm:hidden',
                  paso.situacion === 'HECHA' || paso.situacion === 'OMITIDA' ? 'bg-verde' : 'bg-borde',
                )}
              />
            ) : null}
            <Marcador paso={paso} />
            <div className="flex min-w-0 flex-col gap-0.5 pt-1.5 sm:pt-0">
              <span className="sr-only">{SITUACION_LEGIBLE[paso.situacion]}: </span>
              <span
                className={cn(
                  'text-sm font-semibold',
                  paso.situacion === 'ACTUAL' ? 'text-marino' : paso.situacion === 'PENDIENTE' ? 'text-apagado' : 'text-tinta',
                  paso.situacion === 'OMITIDA' && 'text-apagado line-through decoration-borde',
                )}
              >
                {ETIQUETAS_ETAPA_SEGUIMIENTO[paso.etapa]}
              </span>
              {paso.fecha === null ? null : (
                <span className="text-xs text-apagado">{formatearFechaHora(paso.fecha)}</span>
              )}
              {paso.usuario === null ? null : <span className="truncate text-xs text-apagado">{paso.usuario}</span>}
              {paso.minutosEnEtapa === null || paso.situacion === 'PENDIENTE' || paso.etapa === 'FINALIZADA' ? null : (
                <span
                  className={cn(
                    'mt-0.5 inline-flex self-start rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold sm:self-center',
                    paso.situacion === 'ACTUAL' ? 'bg-marino/10 text-marino' : 'bg-fondo text-apagado',
                  )}
                >
                  {paso.situacion === 'ACTUAL' ? 'Lleva ' : ''}
                  {formatearMinutos(paso.minutosEnEtapa)}
                </span>
              )}
              {paso.etapa === 'EN_REVISION' && seguimiento.rondasObservadas > 0 ? (
                <span className="mt-0.5 inline-flex items-center gap-1 self-start rounded-full bg-rojo-suave px-2 py-0.5 text-[0.6875rem] font-semibold text-rojo sm:self-center">
                  <RotateCcw aria-hidden="true" className="size-3" />
                  {seguimiento.rondasObservadas} {seguimiento.rondasObservadas === 1 ? 'observación' : 'observaciones'}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
