export function nuevoRevisor(
  revisorActual: string | null,
  saliente: string,
  destino: string,
  responsableFinal: string,
  asignadoPor: string,
): string | null {
  const candidato = revisorActual === saliente ? destino : revisorActual;

  if (candidato === null || candidato !== responsableFinal) {
    return candidato;
  }

  return asignadoPor !== responsableFinal ? asignadoPor : null;
}
