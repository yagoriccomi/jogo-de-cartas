/** Junta nomes de classe CSS ignorando os valores "falsos", para evitar concatenações manuais. */
export function classes(...partes: readonly (string | false | null | undefined)[]): string {
  return partes
    .filter((parte): parte is string => typeof parte === 'string' && parte !== '')
    .join(' ');
}
