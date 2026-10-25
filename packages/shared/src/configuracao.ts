export const LIMITES = {
  minJogadores: 2,
  maxJogadores: 10,
  maxBots: 6,
  minBaralhos: 1,
  maxBaralhos: 4,
  minVidas: 5,
  maxVidas: 10,
  maxApelido: 20,
  maxIdentificador: 100,
  /** Token de sessão do login (o do Better Auth tem 32 caracteres; a folga cobre a assinatura). */
  maxTokenDeLogin: 256,
  minPrazoDaVezSegundos: 10,
  maxPrazoDaVezSegundos: 120,
  /** Pausa 'lendo as regras': a mesa espera o novato no máximo isto, uma vez por partida. */
  maxLeituraDasRegrasSegundos: 60,
  /** Teto de partidas por página em "Minhas partidas" (o pedido sem `limite` usa o teto). */
  maxPartidasPorPagina: 20,
} as const;

export interface ConfiguracaoPartida {
  /** Quantos baralhos são misturados (1 a 4). */
  readonly quantidadeBaralhos: number;
  /** Vidas com que cada jogador começa (5 a 10). */
  readonly vidasIniciais: number;
  /** `false` = baralho de truco (sem 8, 9 e 10). */
  readonly incluirOitoNoveDez: boolean;
  /**
   * Jogador eliminado vê a mão dos outros ao tocar na placa deles. O dono pode trocar a qualquer
   * momento, inclusive no meio da partida.
   */
  readonly mortosVeemCartas: boolean;
  /**
   * Segundos para palpitar ou jogar antes de o servidor agir pelo jogador (10 a 120).
   * `null` = sem limite de tempo.
   */
  readonly prazoDaVezSegundos: number | null;
}

export const CONFIGURACAO_PADRAO: ConfiguracaoPartida = {
  quantidadeBaralhos: 1,
  vidasIniciais: 5,
  incluirOitoNoveDez: false,
  mortosVeemCartas: false,
  prazoDaVezSegundos: 30,
};
