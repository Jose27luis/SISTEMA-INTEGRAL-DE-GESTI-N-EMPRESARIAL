import { DIAS_HABILES_SIN_REPORTE, diasHabilesEntre, HORAS_PARA_ACUSE, type Prioridad } from '@sige/types';
import { cn } from '@sige/ui/cn';
import { CalendarClock, Check, ClipboardList, FileCheck2, ShieldCheck, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { PrioridadInsignia } from '@/components/task-badges';
import { formatearPlazo } from '@/lib/format';

export interface DatosVistaPrevia {
  titulo: string;
  instrucciones: string;
  cliente: string | null;
  prioridad: Prioridad;
  fechaLimite: string;
  horaLimite: string;
  responsables: string[];
  colaboradores: string[];
  revisor: string | null;
  requiereAprobacion: boolean;
  requiereEvidencia: boolean;
  evidenciaRequerida: string;
  items: string[];
}

export interface Pendiente {
  campo: string;
  texto: string;
}

interface PropiedadesVistaPrevia {
  datos: DatosVistaPrevia;
  hoy: string;
  pendientes: readonly Pendiente[];
}

function Fila({ icono, children }: { icono: ReactNode; children: ReactNode }): ReactNode {
  return (
    <li className="flex gap-2.5 text-sm">
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-marino-claro">
        {icono}
      </span>
      <span className="min-w-0 text-tinta">{children}</span>
    </li>
  );
}

export function VistaPreviaTarea({ datos, hoy, pendientes }: PropiedadesVistaPrevia): ReactNode {
  const habiles = datos.fechaLimite === '' || datos.fechaLimite < hoy ? null : diasHabilesEntre(hoy, datos.fechaLimite);
  const cadaReporte = DIAS_HABILES_SIN_REPORTE[datos.prioridad];
  const varias = datos.responsables.length > 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-lg border border-borde bg-superficie shadow-sm">
        <div className="h-1.5 bg-gradient-to-r from-marino via-marino-claro to-dorado" />
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-apagado">
                {varias ? `${String(datos.responsables.length)} tareas · código al guardar` : 'Código al guardar'}
              </p>
              <p className={cn('font-semibold break-words', datos.titulo.trim() === '' ? 'text-apagado italic' : 'text-marino')}>
                {datos.titulo.trim() === '' ? 'Sin título' : datos.titulo}
              </p>
              <p className="truncate text-xs text-apagado">{datos.cliente ?? 'Tarea interna'}</p>
            </div>
            <PrioridadInsignia prioridad={datos.prioridad} />
          </div>

          {datos.instrucciones.trim() === '' ? null : (
            <p className="line-clamp-4 text-sm whitespace-pre-line text-apagado">{datos.instrucciones}</p>
          )}

          <ul className="flex flex-col gap-2.5">
            <Fila icono={<CalendarClock className="size-4" />}>
              {datos.fechaLimite === '' ? (
                <span className="text-apagado">Sin fecha límite</span>
              ) : (
                <>
                  Vence el{' '}
                  <span className="font-semibold">
                    {formatearPlazo(datos.fechaLimite, datos.horaLimite === '' ? null : datos.horaLimite)}
                  </span>
                  {habiles === null ? null : (
                    <span className="text-apagado">
                      {' '}
                      · {habiles === 0 ? 'hoy' : `${String(habiles)} ${habiles === 1 ? 'día hábil' : 'días hábiles'}`}
                    </span>
                  )}
                </>
              )}
            </Fila>
            <Fila icono={<Users className="size-4" />}>
              {datos.responsables.length === 0 ? (
                <span className="text-apagado">Sin responsable</span>
              ) : (
                <>
                  <span className="font-semibold">{datos.responsables.join(', ')}</span>
                  {varias ? <span className="text-apagado"> · una tarea para cada uno</span> : null}
                  {datos.colaboradores.length === 0 ? null : (
                    <span className="block text-xs text-apagado">Con {datos.colaboradores.join(', ')}</span>
                  )}
                </>
              )}
            </Fila>
            {datos.items.length === 0 ? null : (
              <Fila icono={<ClipboardList className="size-4" />}>
                {datos.items.length} {datos.items.length === 1 ? 'paso' : 'pasos'} por marcar
                <ol className="mt-1 flex flex-col gap-0.5 text-xs text-apagado">
                  {datos.items.slice(0, 4).map((item, indice) => (
                    <li key={`${item}-${String(indice)}`} className="truncate">
                      {indice + 1}. {item}
                    </li>
                  ))}
                  {datos.items.length > 4 ? <li>y {datos.items.length - 4} más</li> : null}
                </ol>
              </Fila>
            )}
            {datos.requiereAprobacion ? (
              <Fila icono={<ShieldCheck className="size-4" />}>
                Revisa <span className="font-semibold">{datos.revisor ?? 'sin elegir'}</span> antes de cerrarse
              </Fila>
            ) : null}
            {datos.requiereEvidencia ? (
              <Fila icono={<FileCheck2 className="size-4" />}>
                Evidencia: <span className="text-apagado">{datos.evidenciaRequerida.trim() === '' ? 'sin describir' : datos.evidenciaRequerida}</span>
              </Fila>
            ) : null}
          </ul>

          <div className="rounded-md bg-fondo px-3 py-2.5 text-xs text-apagado">
            Seguimiento estricto: confirmar recepción en {HORAS_PARA_ACUSE} h y reportar avance cada {cadaReporte}{' '}
            {cadaReporte === 1 ? 'día hábil' : 'días hábiles'}. La fecha límite solo cambia con prórroga aprobada.
          </div>
        </div>
      </div>

      {pendientes.length === 0 ? (
        <p className="flex items-center gap-2 rounded-md bg-verde-suave px-3 py-2 text-sm font-medium text-verde-oscuro">
          <Check aria-hidden="true" className="size-4" strokeWidth={3} />
          Lista para asignar
        </p>
      ) : (
        <div className="rounded-md border border-borde px-3 py-2.5 text-sm">
          <p className="mb-1 font-medium text-tinta">Falta completar</p>
          <ul className="flex flex-col gap-1">
            {pendientes.map((pendiente) => (
              <li key={pendiente.campo}>
                <a href={`#${pendiente.campo}`} className="text-marino-claro hover:underline">
                  {pendiente.texto}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
