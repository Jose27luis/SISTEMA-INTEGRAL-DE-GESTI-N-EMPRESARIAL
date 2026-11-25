import {
  ESTADOS_CERRADOS,
  ESTADOS_ESPERA_REPORTE,
  type EstadoTarea,
  type EtapaSeguimiento,
  HORAS_PARA_ACUSE,
  limiteDeReporte,
  type PasoSeguimiento,
  type Prioridad,
  type Semaforo,
  semaforoTarea,
} from '@sige/types';

export interface DatosSeguimiento {
  estado: EstadoTarea;
  prioridad: Prioridad;
  fechaLimite: string;
  estricto: boolean;
  creadoEn: Date;
  recibidaEn: Date | null;
  ultimoReporteEn: Date | null;
}

export interface EstadoSeguimiento {
  semaforo: Semaforo;
  esperandoAcuse: boolean;
  sinAcuse: boolean;
  limiteReporte: string | null;
  sinReporte: boolean;
}

function fechaLima(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha);
}

export function evaluarSeguimiento(datos: DatosSeguimiento, ahora: Date, hoy: string): EstadoSeguimiento {
  const semaforo = semaforoTarea(datos.estado, datos.fechaLimite, hoy);
  const abierta = !ESTADOS_CERRADOS.includes(datos.estado);
  const esperandoAcuse = datos.estricto && abierta && datos.estado === 'PENDIENTE' && datos.recibidaEn === null;
  const sinAcuse = esperandoAcuse && ahora.getTime() - datos.creadoEn.getTime() > HORAS_PARA_ACUSE * 3_600_000;
  const base = datos.ultimoReporteEn ?? datos.recibidaEn;
  const esperaReporte = datos.estricto && abierta && !esperandoAcuse && ESTADOS_ESPERA_REPORTE.includes(datos.estado) && base !== null;
  const limiteReporte = esperaReporte ? limiteDeReporte(datos.prioridad, fechaLima(base)) : null;

  return {
    semaforo,
    esperandoAcuse,
    sinAcuse,
    limiteReporte,
    sinReporte: limiteReporte !== null && hoy > limiteReporte,
  };
}

export interface TransicionRegistrada {
  hacia: EstadoTarea;
  fecha: Date;
  usuario: string;
}

const ORDEN: Record<EtapaSeguimiento, number> = {
  ASIGNADA: 0,
  RECIBIDA: 1,
  EN_PROCESO: 2,
  EN_REVISION: 3,
  APROBADA: 4,
  FINALIZADA: 5,
};

function etapaActual(estado: EstadoTarea, recibida: boolean, estricto: boolean): EtapaSeguimiento {
  switch (estado) {
    case 'PENDIENTE':
      return estricto && recibida ? 'RECIBIDA' : 'ASIGNADA';
    case 'EN_PROCESO':
      return 'EN_PROCESO';
    case 'EN_REVISION':
    case 'OBSERVADA':
    case 'CORREGIDA':
      return 'EN_REVISION';
    case 'APROBADA':
      return 'APROBADA';
    case 'FINALIZADA':
    case 'CANCELADA':
      return 'FINALIZADA';
  }
}

export function armarPasos(
  datos: {
    estado: EstadoTarea;
    estricto: boolean;
    requiereAprobacion: boolean;
    creadoEn: Date;
    asignadoPor: string;
    recibidaEn: Date | null;
    responsable: string;
  },
  transiciones: readonly TransicionRegistrada[],
  ahora: Date,
): PasoSeguimiento[] {
  const primera = (estados: readonly EstadoTarea[]): TransicionRegistrada | undefined =>
    [...transiciones].sort((a, b) => a.fecha.getTime() - b.fecha.getTime()).find(({ hacia }) => estados.includes(hacia));
  const ocurrencias: Record<EtapaSeguimiento, { fecha: Date; usuario: string } | null> = {
    ASIGNADA: { fecha: datos.creadoEn, usuario: datos.asignadoPor },
    RECIBIDA: datos.recibidaEn === null ? null : { fecha: datos.recibidaEn, usuario: datos.responsable },
    EN_PROCESO: primera(['EN_PROCESO']) ?? null,
    EN_REVISION: primera(['EN_REVISION']) ?? null,
    APROBADA: primera(['APROBADA']) ?? null,
    FINALIZADA: primera(['FINALIZADA']) ?? null,
  };
  const actual = etapaActual(datos.estado, datos.recibidaEn !== null, datos.estricto);
  const etapas = (Object.keys(ORDEN) as EtapaSeguimiento[]).filter(
    (etapa) =>
      (etapa !== 'RECIBIDA' || datos.estricto) &&
      (datos.requiereAprobacion || (etapa !== 'EN_REVISION' && etapa !== 'APROBADA')),
  );

  return etapas.map((etapa, indice) => {
    const ocurrencia = ocurrencias[etapa];
    const siguiente = etapas.slice(indice + 1).map((otra) => ocurrencias[otra]).find((valor) => valor !== null);
    let situacion: PasoSeguimiento['situacion'];

    if (datos.estado === 'CANCELADA') {
      situacion = ocurrencia === null ? 'OMITIDA' : 'HECHA';
    } else if (ORDEN[etapa] < ORDEN[actual]) {
      situacion = ocurrencia === null ? 'OMITIDA' : 'HECHA';
    } else if (etapa === actual) {
      situacion = etapa === 'FINALIZADA' ? 'HECHA' : 'ACTUAL';
    } else {
      situacion = 'PENDIENTE';
    }

    const hasta = siguiente?.fecha ?? (situacion === 'ACTUAL' ? ahora : null);

    return {
      etapa,
      situacion,
      fecha: ocurrencia === null ? null : ocurrencia.fecha.toISOString(),
      usuario: ocurrencia?.usuario ?? null,
      minutosEnEtapa:
        ocurrencia !== null && hasta !== null && situacion !== 'PENDIENTE'
          ? Math.max(0, Math.round((hasta.getTime() - ocurrencia.fecha.getTime()) / 60_000))
          : null,
    };
  });
}
