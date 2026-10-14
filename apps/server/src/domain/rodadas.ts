export { maxCartasPorJogador } from '@fodinha/shared';

/**
 * Rodadas progressivas: 1, 2, 3… até o máximo possível e então voltam para 1.
 * O máximo é recalculado a cada rodada porque cresce conforme jogadores são eliminados.
 */
export function proximaQuantidadeDeCartas(anterior: number | null, maximo: number): number {
  if (anterior === null || anterior >= maximo) return 1;
  return anterior + 1;
}

/**
 * O pé (último a palpitar) não pode fazer a soma dos palpites igualar o número de cartas,
 * garantindo que ao menos um jogador erre.
 */
export function palpiteProibidoDoPe(
  somaDosOutrosPalpites: number,
  cartasNaRodada: number,
): number | null {
  const proibido = cartasNaRodada - somaDosOutrosPalpites;
  return proibido >= 0 ? proibido : null;
}

export function vidasPerdidas(palpite: number, vazasFeitas: number): number {
  return Math.abs(palpite - vazasFeitas);
}
