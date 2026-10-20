interface Assento {
  readonly id: string;
  readonly eliminado: boolean;
}

/**
 * Jogadores na ordem em que jogam a rodada: a mão primeiro e o pé por último. Eliminados vão para
 * o fim, para não ficarem entre o pé e a mão. Fora da rodada (resultado), a mão é quem estava
 * depois do pé, então a ordem não pula enquanto o resultado está na tela.
 */
export function emOrdemDeJogo<T extends Assento>(
  jogadores: readonly T[],
  idDoPrimeiro: string | null,
  idDoPe: string | null,
): T[] {
  const indiceDoPrimeiro = jogadores.findIndex((j) => j.id === idDoPrimeiro);
  const indiceDoPe = jogadores.findIndex((j) => j.id === idDoPe);
  const inicio =
    indiceDoPrimeiro !== -1 ? indiceDoPrimeiro : indiceDoPe !== -1 ? indiceDoPe + 1 : 0;
  const girados = jogadores.map((_, i) => jogadores[(inicio + i) % jogadores.length] as T);
  return [...girados.filter((j) => !j.eliminado), ...girados.filter((j) => j.eliminado)];
}
