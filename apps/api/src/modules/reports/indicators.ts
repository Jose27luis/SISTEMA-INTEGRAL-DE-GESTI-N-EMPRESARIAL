import { type ConteoTareas, ESTADOS_CERRADOS, type EstadoTarea } from '@sige/types';

export interface TareaIndicador {
  responsableId: string;
  estado: EstadoTarea;
  fechaLimite: string;
  creadaEl: string;
  completadaEl: string | null;
}

export interface RondaIndicador {
  responsableId: string;
  decision: 'APROBADA' | 'OBSERVADA';
  fecha: string;
}

export interface MinutosIndicador {
  autorId: string;
  minutos: number;
}

export interface Periodo {
  desde: string;
  hasta: string;
}

function enPeriodo(fecha: string, periodo: Periodo): boolean {
  return fecha >= periodo.desde && fecha <= periodo.hasta;
}

export function calcularConteo(
  tareas: readonly TareaIndicador[],
  rondas: readonly RondaIndicador[],
  minutos: readonly MinutosIndicador[],
  periodo: Periodo,
  hoy: string,
): ConteoTareas {
  let asignadas = 0;
  let terminadas = 0;
  let abiertas = 0;
  let atrasadas = 0;
  let evaluables = 0;
  let cumplidas = 0;

  for (const tarea of tareas) {
    const abierta = !ESTADOS_CERRADOS.includes(tarea.estado);

    if (enPeriodo(tarea.creadaEl, periodo)) {
      asignadas += 1;
    }

    if (tarea.completadaEl !== null && enPeriodo(tarea.completadaEl, periodo)) {
      terminadas += 1;
    }

    if (abierta) {
      abiertas += 1;

      if (tarea.fechaLimite < hoy) {
        atrasadas += 1;
      }
    }

    if (tarea.estado !== 'CANCELADA' && enPeriodo(tarea.fechaLimite, periodo)) {
      const aTiempo = tarea.completadaEl !== null && tarea.completadaEl <= tarea.fechaLimite;

      if (tarea.completadaEl !== null || tarea.fechaLimite < hoy) {
        evaluables += 1;
        cumplidas += aTiempo ? 1 : 0;
      }
    }
  }

  return {
    asignadas,
    terminadas,
    aprobadas: rondas.filter((ronda) => ronda.decision === 'APROBADA').length,
    observadas: rondas.filter((ronda) => ronda.decision === 'OBSERVADA').length,
    abiertas,
    atrasadas,
    minutos: minutos.reduce((suma, registro) => suma + registro.minutos, 0),
    cumplimiento: evaluables === 0 ? null : Math.round((cumplidas * 100) / evaluables),
  };
}

export function sumarConteos(conteos: readonly ConteoTareas[], cumplimiento: number | null): ConteoTareas {
  const total = conteos.reduce<ConteoTareas>(
    (suma, conteo) => ({
      asignadas: suma.asignadas + conteo.asignadas,
      terminadas: suma.terminadas + conteo.terminadas,
      aprobadas: suma.aprobadas + conteo.aprobadas,
      observadas: suma.observadas + conteo.observadas,
      abiertas: suma.abiertas + conteo.abiertas,
      atrasadas: suma.atrasadas + conteo.atrasadas,
      minutos: suma.minutos + conteo.minutos,
      cumplimiento: null,
    }),
    { asignadas: 0, terminadas: 0, aprobadas: 0, observadas: 0, abiertas: 0, atrasadas: 0, minutos: 0, cumplimiento: null },
  );

  return { ...total, cumplimiento };
}
