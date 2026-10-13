export const LIMITES = {
  minJogadores: 2,
  maxJogadores: 10,
  maxBots: 4,
  minBaralhos: 1,
  maxBaralhos: 4,
  minVidas: 5,
  maxVidas: 10,
  maxApelido: 20,
} as const;

export interface ConfiguracaoPartida {
  /** Quantos baralhos são misturados (1 a 4). */
  readonly quantidadeBaralhos: number;
  /** Vidas com que cada jogador começa (5 a 10). */
  readonly vidasIniciais: number;
  /** `false` = baralho de truco (sem 8, 9 e 10). */
  readonly incluirOitoNoveDez: boolean;
}

export const CONFIGURACAO_PADRAO: ConfiguracaoPartida = {
  quantidadeBaralhos: 1,
  vidasIniciais: 5,
  incluirOitoNoveDez: false,
};
