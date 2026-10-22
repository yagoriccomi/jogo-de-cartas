import type { EstrategiaDeJogo } from './estrategia-bot';
import type { Partida } from './partida';

/** O que a estratégia fez pela vez: quem chama decide o que mais acontece (reação do bot, placar). */
export type JogadaDaVez =
  | { readonly tipo: 'palpite'; readonly quantidade: number }
  | { readonly tipo: 'carta'; readonly cartaId: string };

/**
 * Única forma de a estratégia agir por alguém: palpite ou carta conforme a fase, decidida só com
 * a visão que esse jogador teria. Serve ao bot, a quem estourou o prazo e às simulações.
 */
export function jogarAVez(
  partida: Partida,
  jogadorId: string,
  estrategia: EstrategiaDeJogo,
): JogadaDaVez {
  const visao = partida.visaoPara(jogadorId);
  if (partida.faseAtual === 'palpites') {
    const permitidos = partida.palpitesPermitidos(jogadorId);
    const quantidade = estrategia.escolherPalpite(visao, jogadorId, permitidos);
    partida.palpitar(jogadorId, quantidade);
    return { tipo: 'palpite', quantidade };
  }
  const cartaId = estrategia.escolherCarta(visao, jogadorId);
  partida.jogarCarta(jogadorId, cartaId);
  return { tipo: 'carta', cartaId };
}
