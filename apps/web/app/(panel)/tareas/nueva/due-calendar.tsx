'use client';

import { sumarDiasHabiles } from '@sige/types';
import { cn } from '@sige/ui/cn';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type ReactNode, useState } from 'react';

const NOMBRES_DIA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const FORMATO_MES = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const FORMATO_DIA = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

function aIso(anio: number, mes: number, dia: number): string {
  return new Date(Date.UTC(anio, mes, dia)).toISOString().slice(0, 10);
}

function partes(fecha: string): { anio: number; mes: number } {
  return { anio: Number(fecha.slice(0, 4)), mes: Number(fecha.slice(5, 7)) - 1 };
}

function ultimoHabilDelMes(hoy: string): string {
  const { anio, mes } = partes(hoy);
  const dia = new Date(Date.UTC(anio, mes + 1, 0));

  while (dia.getUTCDay() === 0 || dia.getUTCDay() === 6) {
    dia.setUTCDate(dia.getUTCDate() - 1);
  }

  const resultado = dia.toISOString().slice(0, 10);
  return resultado <= hoy ? sumarDiasHabiles(hoy, 1) : resultado;
}

interface PropiedadesCalendarioVencimientos {
  hoy: string;
  minimo: string;
  valor: string;
  onElegir: (fecha: string) => void;
  vencimientos: ReadonlyMap<string, number>;
  nombres: string;
}

export function CalendarioVencimientos({
  hoy,
  minimo,
  valor,
  onElegir,
  vencimientos,
  nombres,
}: PropiedadesCalendarioVencimientos): ReactNode {
  const [vista, setVista] = useState(() => partes(valor === '' ? hoy : valor));
  const [enfocado, setEnfocado] = useState<string | null>(null);
  const primerDia = new Date(Date.UTC(vista.anio, vista.mes, 1)).getUTCDay();
  const desplazamiento = (primerDia + 6) % 7;
  const diasMes = new Date(Date.UTC(vista.anio, vista.mes + 1, 0)).getUTCDate();
  const celdas = Array.from({ length: Math.ceil((desplazamiento + diasMes) / 7) * 7 }, (_, indice) => {
    const dia = indice - desplazamiento + 1;
    return dia < 1 || dia > diasMes ? null : aIso(vista.anio, vista.mes, dia);
  });
  const mesActual = partes(hoy);
  const puedeRetroceder = vista.anio > mesActual.anio || (vista.anio === mesActual.anio && vista.mes > mesActual.mes);
  const atajos = [
    { etiqueta: 'Siguiente día hábil', fecha: sumarDiasHabiles(hoy, 1) },
    { etiqueta: '3 días hábiles', fecha: sumarDiasHabiles(hoy, 3) },
    { etiqueta: '1 semana', fecha: sumarDiasHabiles(hoy, 5) },
    { etiqueta: '2 semanas', fecha: sumarDiasHabiles(hoy, 10) },
    { etiqueta: 'Fin de mes', fecha: ultimoHabilDelMes(hoy) },
  ].filter(({ fecha }) => fecha >= minimo);
  const resaltado = enfocado ?? (valor === '' ? null : valor);
  const cargaResaltada = resaltado === null ? 0 : (vencimientos.get(resaltado) ?? 0);

  const elegir = (fecha: string): void => {
    onElegir(fecha);
    setVista(partes(fecha));
  };

  const cambiarMes = (paso: number): void => {
    setVista(({ anio, mes }) => {
      const fecha = new Date(Date.UTC(anio, mes + paso, 1));
      return { anio: fecha.getUTCFullYear(), mes: fecha.getUTCMonth() };
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Plazos rápidos" className="flex flex-wrap gap-2">
        {atajos.map((atajo) => (
          <button
            key={atajo.etiqueta}
            type="button"
            aria-pressed={valor === atajo.fecha}
            onClick={() => {
              elegir(atajo.fecha);
            }}
            className={cn(
              'inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-medium transition-colors',
              valor === atajo.fecha
                ? 'border-marino bg-marino text-superficie'
                : 'border-borde bg-superficie text-tinta hover:border-marino-claro',
            )}
          >
            {atajo.etiqueta}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-borde bg-superficie p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            aria-label="Mes anterior"
            disabled={!puedeRetroceder}
            onClick={() => {
              cambiarMes(-1);
            }}
            className="grid size-9 place-items-center rounded-md text-marino hover:bg-marino/8 disabled:opacity-30"
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
          </button>
          <span className="text-sm font-semibold text-marino capitalize">
            {FORMATO_MES.format(new Date(Date.UTC(vista.anio, vista.mes, 1)))}
          </span>
          <button
            type="button"
            aria-label="Mes siguiente"
            onClick={() => {
              cambiarMes(1);
            }}
            className="grid size-9 place-items-center rounded-md text-marino hover:bg-marino/8"
          >
            <ChevronRight aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {NOMBRES_DIA.map((nombre) => (
            <span key={nombre} className="pb-1 text-[0.6875rem] font-semibold text-apagado uppercase">
              {nombre}
            </span>
          ))}
          {celdas.map((fecha, indice) => {
            if (fecha === null) {
              return <span key={`vacio-${String(indice)}`} />;
            }

            const cantidad = vencimientos.get(fecha) ?? 0;
            const finDeSemana = indice % 7 >= 5;
            const fuera = fecha < minimo;
            const elegido = fecha === valor;

            return (
              <button
                key={fecha}
                type="button"
                disabled={fuera}
                aria-pressed={elegido}
                aria-label={`${FORMATO_DIA.format(new Date(`${fecha}T00:00:00Z`))}${cantidad > 0 ? `, ${String(cantidad)} ${cantidad === 1 ? 'vencimiento' : 'vencimientos'}` : ''}`}
                onClick={() => {
                  elegir(fecha);
                }}
                onMouseEnter={() => {
                  setEnfocado(fecha);
                }}
                onMouseLeave={() => {
                  setEnfocado(null);
                }}
                onFocus={() => {
                  setEnfocado(fecha);
                }}
                onBlur={() => {
                  setEnfocado(null);
                }}
                className={cn(
                  'relative flex aspect-square min-h-9 flex-col items-center justify-center rounded-md text-sm tabular-nums transition-colors',
                  elegido
                    ? 'bg-marino font-semibold text-superficie shadow-sm'
                    : fuera
                      ? 'text-borde'
                      : cn('hover:bg-marino/8', finDeSemana ? 'text-apagado' : 'text-tinta'),
                  fecha === hoy && !elegido && 'ring-1 ring-marino-claro',
                  !elegido && !fuera && cantidad >= 3 && 'bg-rojo-suave',
                  !elegido && !fuera && cantidad > 0 && cantidad < 3 && 'bg-dorado-suave',
                )}
              >
                {Number(fecha.slice(8))}
                {cantidad > 0 ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute right-0.5 bottom-0.5 min-w-4 rounded-full px-1 text-[0.625rem] leading-4 font-bold',
                      elegido ? 'bg-superficie text-marino' : cantidad >= 3 ? 'bg-rojo text-superficie' : 'bg-dorado text-superficie',
                    )}
                  >
                    {cantidad}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <p aria-live="polite" className="mt-3 min-h-10 border-t border-borde pt-2 text-xs text-apagado">
          {resaltado === null
            ? nombres === ''
              ? 'Elija un responsable para ver sus vencimientos en el calendario.'
              : `Los números indican cuántas tareas de ${nombres} vencen ese día.`
            : `${FORMATO_DIA.format(new Date(`${resaltado}T00:00:00Z`))}: ${
                nombres === ''
                  ? 'sin responsable elegido.'
                  : cargaResaltada === 0
                    ? `${nombres} no tiene otros vencimientos.`
                    : `${nombres} ya tiene ${String(cargaResaltada)} ${cargaResaltada === 1 ? 'tarea que vence' : 'tareas que vencen'} ese día.`
              }`}
        </p>
      </div>
    </div>
  );
}
