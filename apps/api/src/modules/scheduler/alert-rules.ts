export type TipoAlertaTarea = 'TAREA_ATRASADA' | 'TAREA_POR_VENCER';

export function clasificarAlerta(fechaLimite: string, hoy: string, manana: string): TipoAlertaTarea | null {
  if (fechaLimite < hoy) {
    return 'TAREA_ATRASADA';
  }

  if (fechaLimite === hoy || fechaLimite === manana) {
    return 'TAREA_POR_VENCER';
  }

  return null;
}

export function claveAlerta(
  tipo: TipoAlertaTarea,
  tareaId: string,
  fechaLimite: string,
  hoy: string,
  usuarioId: string,
): string {
  const periodo = tipo === 'TAREA_POR_VENCER' ? `vence-${fechaLimite}-aviso-${hoy}` : `atraso-${hoy}`;
  return `${tipo}:${tareaId}:${periodo}:${usuarioId}`;
}
