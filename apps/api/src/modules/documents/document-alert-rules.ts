const MS_POR_DIA = 86_400_000;

export type AvisoFecha = { tipo: 'PREVIO'; dias: number } | { tipo: 'VENCIDO' };

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / MS_POR_DIA);
}

export function clasificarAvisoFecha(fecha: string, hoy: string, diasAviso: readonly number[]): AvisoFecha | null {
  const dias = diasEntre(hoy, fecha);

  if (dias < 0) {
    return { tipo: 'VENCIDO' };
  }

  return diasAviso.includes(dias) ? { tipo: 'PREVIO', dias } : null;
}

export function claveAvisoFecha(
  prefijo: string,
  entidadId: string,
  fecha: string,
  aviso: AvisoFecha,
  usuarioId: string,
): string {
  const momento = aviso.tipo === 'VENCIDO' ? `vencio-${fecha}` : `vence-${fecha}-faltan-${String(aviso.dias)}`;
  return `${prefijo}:${entidadId}:${momento}:${usuarioId}`;
}

export function textoPlazo(aviso: AvisoFecha): string {
  if (aviso.tipo === 'VENCIDO') {
    return 'venció';
  }

  return aviso.dias === 1 ? 'vence mañana' : `vence en ${String(aviso.dias)} días`;
}
