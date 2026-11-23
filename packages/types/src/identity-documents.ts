const FACTORES_RUC = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;
const PREFIJOS_RUC = ['10', '15', '16', '17', '20'] as const;

export function esRucValido(ruc: string): boolean {
  if (!/^\d{11}$/.test(ruc) || !PREFIJOS_RUC.some((prefijo) => ruc.startsWith(prefijo))) {
    return false;
  }

  const suma = FACTORES_RUC.reduce((total, factor, indice) => total + factor * Number(ruc.charAt(indice)), 0);
  const resto = 11 - (suma % 11);
  const verificador = resto === 10 ? 0 : resto === 11 ? 1 : resto;

  return verificador === Number(ruc.charAt(10));
}

export function esDniValido(dni: string): boolean {
  return /^\d{8}$/.test(dni);
}
