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

/** Carta na mesa. A mesa mostra as que valem numa linha e as anuladas (empatadas) em outra. */
export interface JogadaNaMesa extends Jogada {
  /** Empatou em força com outra carta da mesma vaza: não vale mais. */
  readonly anulada: boolean;
}

/**
 * A vaza recém-fechada. A mesa não a exibe como "última vaza": serve para animar o montinho
 * indo da mesa até quem ganhou (ou saindo da mesa, se todas se anularam).
 */
export interface VazaResolvida {
  readonly jogadas: readonly JogadaNaMesa[];
  /** `null` quando todas as cartas se anularam. */
  readonly vencedorId: string | null;
}

/** Um montinho na frente do jogador: a carta que venceu fica por cima. */
export interface VazaGanha {
  readonly cartaVencedora: Carta;
  readonly quantidadeDeCartas: number;
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
  /** Um montinho por vaza ganha nesta rodada, na ordem em que foram ganhas. */
  readonly vazasGanhas: readonly VazaGanha[];
  readonly cartasNaMao: number;
  /** Só preenchido na rodada cega: a carta "na testa" dos outros jogadores. */
  readonly cartaNaTesta: Carta | null;
  /** Saiu, foi expulso ou votado para fora: um bot termina a rodada por ele. */
  readonly saiAoFimDaRodada: boolean;
}

export interface VotoEspera {
  readonly eleitorId: string;
  /** `null` = ainda não votou. */
  readonly esperar: boolean | null;
}

/** "Deseja esperar o retorno de [apelido]?" — basta um SIM para continuar esperando. */
export interface VotacaoEspera {
  readonly ausenteId: string;
  readonly apelido: string;
  /** Instante (epoch ms) da queda de conexão. */
  readonly desconectadoDesde: number;
  readonly votos: readonly VotoEspera[];
}

/** Intervalo entre rodadas: o que vem a seguir, calculado pelo servidor. */
export interface ProximaRodadaVisivel {
  readonly cartasPorJogador: number;
  readonly idDoPrimeiro: string;
  /** Tempo até a distribuição no momento do envio (`null` se a mesa estiver pausada). */
  readonly comecaEmMs: number | null;
}

/** Partida congelada (sem prazo da vez, sem jogada de bot) enquanto houver votação aberta. */
export interface PausaVisivel {
  readonly votacoes: readonly VotacaoEspera[];
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
  /** Quem abre a rodada (primeiro a palpitar). */
  readonly idDoPrimeiro: string | null;
  readonly idDaVez: string | null;
  /** Instante (epoch ms) em que o servidor joga automaticamente pelo jogador da vez. */
  readonly prazoDaVezEm: number | null;
  /** Tempo restante no momento do envio: use-o para a contagem, imune ao relógio do aparelho. */
  readonly prazoDaVezRestanteMs: number | null;
  /** Ordenada da carta mais forte para a mais fraca (considerando a manilha da rodada). */
  readonly minhaMao: readonly CartaNaMao[];
  /** Ordenada da mais forte para a mais fraca (a mais forte fica à frente da fila). */
  readonly mesa: readonly JogadaNaMesa[];
  readonly ultimaVaza: VazaResolvida | null;
  /** Palpite que o jogador não pode dar por ser o pé (null se não houver restrição). */
  readonly palpiteProibido: number | null;
  /** Preenchido ao fim de cada rodada (e mantido até a próxima distribuição). */
  readonly resultadoRodada: readonly ResultadoJogadorNaRodada[] | null;
  /** Só na fase `fim_de_rodada`. */
  readonly proximaRodada: ProximaRodadaVisivel | null;
  /** Vários vencedores = empate (todos os restantes zeraram na mesma rodada com as mesmas vidas). */
  readonly vencedores: readonly string[];
  readonly pausa: PausaVisivel | null;
}
