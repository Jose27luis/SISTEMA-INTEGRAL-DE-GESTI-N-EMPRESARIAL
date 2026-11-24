import type { ClienteBaseDatos } from '../audit/audit.service';

export async function generarCodigoTarea(db: ClienteBaseDatos): Promise<string> {
  const [fila] = await db.$queryRaw<{ numero: bigint }[]>`SELECT nextval('tareas_codigo_seq') AS numero`;

  if (fila === undefined) {
    throw new Error('No se pudo generar el código de la tarea');
  }

  return `T-${String(new Date().getFullYear())}-${fila.numero.toString().padStart(6, '0')}`;
}
