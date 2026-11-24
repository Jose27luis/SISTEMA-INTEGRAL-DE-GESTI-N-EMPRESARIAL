export const PERIODOS = [
  { clave: 'hoy', etiqueta: 'Hoy' },
  { clave: 'semana', etiqueta: 'Esta semana' },
  { clave: 'mes', etiqueta: 'Este mes' },
  { clave: 'mes-anterior', etiqueta: 'Mes anterior' },
  { clave: 'anio', etiqueta: 'Este año' },
] as const;

export type ClavePeriodo = (typeof PERIODOS)[number]['clave'];

export interface RangoFechas {
  desde: string;
  hasta: string;
}

function aTexto(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function desdeTexto(fecha: string): Date {
  return new Date(`${fecha}T00:00:00Z`);
}

export function rangoDePeriodo(clave: ClavePeriodo, hoy: string): RangoFechas {
  const fecha = desdeTexto(hoy);
  const anio = fecha.getUTCFullYear();
  const mes = fecha.getUTCMonth();

  switch (clave) {
    case 'hoy':
      return { desde: hoy, hasta: hoy };
    case 'semana': {
      const lunes = new Date(fecha);
      lunes.setUTCDate(fecha.getUTCDate() - ((fecha.getUTCDay() + 6) % 7));
      const domingo = new Date(lunes);
      domingo.setUTCDate(lunes.getUTCDate() + 6);
      return { desde: aTexto(lunes), hasta: aTexto(domingo) };
    }
    case 'mes':
      return { desde: aTexto(new Date(Date.UTC(anio, mes, 1))), hasta: aTexto(new Date(Date.UTC(anio, mes + 1, 0))) };
    case 'mes-anterior':
      return { desde: aTexto(new Date(Date.UTC(anio, mes - 1, 1))), hasta: aTexto(new Date(Date.UTC(anio, mes, 0))) };
    case 'anio':
      return { desde: `${String(anio)}-01-01`, hasta: `${String(anio)}-12-31` };
  }
}

const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/u;

export function leerRango(
  parametros: Record<string, string | string[] | undefined>,
  hoy: string,
  predeterminado: ClavePeriodo = 'mes',
): RangoFechas & { periodo: ClavePeriodo | 'personalizado' } {
  const valor = (clave: string): string => {
    const crudo = parametros[clave];
    return (Array.isArray(crudo) ? crudo[0] : crudo) ?? '';
  };
  const periodo = PERIODOS.find(({ clave }) => clave === valor('periodo'))?.clave;
  const desde = valor('desde');
  const hasta = valor('hasta');

  if (periodo === undefined && FECHA_VALIDA.test(desde) && FECHA_VALIDA.test(hasta)) {
    return { desde, hasta, periodo: 'personalizado' };
  }

  const clave = periodo ?? predeterminado;
  return { ...rangoDePeriodo(clave, hoy), periodo: clave };
}
