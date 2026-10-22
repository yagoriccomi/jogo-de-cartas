import type { EstadoPartidaVisivel, JogadorVisivel } from '@fodinha/shared';
import { TEMPOS_DA_ANIMACAO } from './animacao-compartilhada';

/** Limite visual: além disto a distribuição ficaria longa e pesada sem acrescentar nada. */
export const MAXIMO_DE_VOOS_POR_JOGADOR = 10;
/** Ao montar a tela no começo da partida (sem rodada anterior) ainda vale distribuir. */
export const JANELA_DE_ABERTURA_MS = 2500;

/** Destino de cada carta distribuída, na ordem: id do adversário, ou `null` se for minha. */
export type Entrega = readonly (string | null)[];

/**
 * Ordem da distribuição: uma carta por vivo a cada volta, começando pela mão da rodada. Quem
 * está fora da rodada (eliminado, ou recém-chegado esperando sentar) não recebe nada.
 */
export function planejarEntrega(jogo: EstadoPartidaVisivel, meuId: string | null): Entrega {
  const { jogadores } = jogo;
  const inicio = Math.max(
    jogadores.findIndex((jogador) => jogador.id === jogo.idDoPrimeiro),
    0,
  );
  const ordem: JogadorVisivel[] = [
    ...jogadores.slice(inicio),
    ...jogadores.slice(0, inicio),
  ].filter((jogador) => !jogador.eliminado && jogador.cartasNaMao > 0);
  const voltas = Math.min(
    Math.max(0, ...ordem.map((jogador) => jogador.cartasNaMao)),
    MAXIMO_DE_VOOS_POR_JOGADOR,
  );
  const entrega: (string | null)[] = [];
  for (let volta = 0; volta < voltas; volta += 1) {
    for (const jogador of ordem) {
      if (jogador.cartasNaMao > volta) entrega.push(jogador.id === meuId ? null : jogador.id);
    }
  }
  return entrega;
}

/**
 * Partida recém-aberta (ninguém palpitou ainda e o estado acabou de chegar): a mão e o baralho
 * animam juntos a 1ª distribuição. O instante `agora` vem de fora para a regra não ler o relógio.
 */
export function estaNaAberturaDaPartida(
  jogo: EstadoPartidaVisivel,
  recebidoEm: number,
  agora: number,
): boolean {
  return (
    jogo.fase === 'palpites' &&
    jogo.jogadores.every((jogador) => jogador.palpite === null) &&
    agora - recebidoEm < JANELA_DE_ABERTURA_MS
  );
}

export interface EntradaDoBaralho {
  readonly jogo: EstadoPartidaVisivel;
  readonly meuId: string | null;
  /** Primeira rodada vista desde que a mesa montou (entrada, reconexão ou abertura). */
  readonly primeiraVez: boolean;
  readonly recebidoEm: number;
  readonly agora: number;
  readonly menosMovimento: boolean;
}

/**
 * Decide se a rodada que acabou de chegar ganha a distribuição do baralho, e com que entrega.
 * Rodada nova sempre distribui; a primeira vista só se for a abertura da partida (quem entra ou
 * reconecta no meio não vê cartas que já estavam na mão sendo distribuídas de novo).
 */
export function planejarBaralho(entrada: EntradaDoBaralho): Entrega | null {
  const { jogo, meuId, primeiraVez, recebidoEm, agora, menosMovimento } = entrada;
  if (menosMovimento) return null;
  if (primeiraVez && !estaNaAberturaDaPartida(jogo, recebidoEm, agora)) return null;
  return planejarEntrega(jogo, meuId);
}

/** Quanto esperar, depois do embaralhar, até a última carta pousar e a vira poder virar. */
export function esperaAteAViraMs(entrega: Entrega): number {
  const { intervaloDaDistribuicaoMs, vooDaCartaMs } = TEMPOS_DA_ANIMACAO;
  return Math.max(0, entrega.length - 1) * intervaloDaDistribuicaoMs + vooDaCartaMs;
}

/** Atraso do voo da carta na posição `posicao` da entrega, contado do fim do embaralhar. */
export function atrasoNaEntregaMs(posicao: number): number {
  return posicao * TEMPOS_DA_ANIMACAO.intervaloDaDistribuicaoMs;
}
