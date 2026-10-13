import type { Carta, CartaNaMao, Valor } from './cartas';
import type { ConfiguracaoPartida } from './configuracao';

/** `fim_de_rodada`: pausa para exibir o resultado antes de o servidor distribuir a próxima rodada. */
export type FasePartida = 'palpites' | 'jogando' | 'fim_de_rodada' | 'encerrada';

export interface ResultadoJogadorNaRodada {
  readonly jogadorId: string;
  readonly palpite: number;
  readonly vazasFeitas: number;
  readonly vidasPerdidas: number;
}

export interface Jogada {
  readonly jogadorId: string;
  readonly carta: Carta;
}

export interface VazaResolvida {
  readonly jogadas: readonly Jogada[];
  /** `null` quando todas as cartas se anularam. */
  readonly vencedorId: string | null;
}

export interface JogadorVisivel {
  readonly id: string;
  readonly apelido: string;
  readonly ehBot: boolean;
  readonly conectado: boolean;
  readonly vidas: number;
  readonly eliminado: boolean;
  readonly palpite: number | null;
  readonly vazasFeitas: number;
  readonly cartasNaMao: number;
  /** Só preenchido na rodada cega: a carta "na testa" dos outros jogadores. */
  readonly cartaNaTesta: Carta | null;
}

/**
 * Projeção do estado da partida para UM jogador. O servidor nunca envia a mão
 * dos adversários (exceto a carta na testa da rodada cega) nem o baralho restante.
 */
export interface EstadoPartidaVisivel {
  readonly configuracao: ConfiguracaoPartida;
  readonly fase: FasePartida;
  readonly numeroRodada: number;
  readonly cartasPorJogador: number;
  readonly rodadaCega: boolean;
  readonly vira: Carta | null;
  readonly manilha: Valor | null;
  readonly jogadores: readonly JogadorVisivel[];
  readonly idDoPe: string | null;
  readonly idDaVez: string | null;
  /** Instante (epoch ms) em que o servidor joga automaticamente pelo jogador da vez. */
  readonly prazoDaVezEm: number | null;
  readonly minhaMao: readonly CartaNaMao[];
  readonly mesa: readonly Jogada[];
  readonly ultimaVaza: VazaResolvida | null;
  /** Palpite que o jogador não pode dar por ser o pé (null se não houver restrição). */
  readonly palpiteProibido: number | null;
  /** Preenchido ao fim de cada rodada (e mantido até a próxima distribuição). */
  readonly resultadoRodada: readonly ResultadoJogadorNaRodada[] | null;
  /** Vários vencedores = empate (todos os restantes zeraram na mesma rodada com as mesmas vidas). */
  readonly vencedores: readonly string[];
}
