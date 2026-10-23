/**
 * Pausas do servidor que o cliente precisa caber dentro: a cena da última vaza (parada, voo e,
 * na rodada cega, a revelação) acontece enquanto o servidor segura o fim da rodada.
 */
export const PAUSAS_DO_FIM_DE_RODADA = {
  /**
   * Inclui ~4 s da última vaza (3 s parada na mesa + o voo ao montinho) e deixa o resultado da
   * rodada ~6 s na tela, o tempo que os jogadores aprovaram.
   */
  normalMs: 10_000,
  /** A rodada cega se resolve sozinha: a revelação no cliente leva ~3 s a mais para ser lida. */
  extraDaRodadaCegaMs: 4_000,
} as const;
