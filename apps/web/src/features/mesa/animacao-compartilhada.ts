/**
 * Contrato entre as animações da MÃO (Mao.tsx) e da MESA (TelaMesa.tsx): tempos em comum, para
 * a distribuição e as jogadas ficarem em sincronia, e os pontos de encontro no DOM.
 */

export const TEMPOS_DA_ANIMACAO = {
  /** O baralho do centro é embaralhado antes de qualquer carta sair. */
  embaralharMs: 700,
  /** Intervalo entre cartas consecutivas na distribuição (uma por jogador, em volta da mesa). */
  intervaloDaDistribuicaoMs: 55,
  /** Voo de uma carta do baralho até a mão/placa, ou da mão/placa até a mesa. */
  vooDaCartaMs: 380,
  /** Depois de todas chegarem fora de ordem, a mão se organiza (mais forte → mais fraca). */
  organizarMaoMs: 280,
} as const;

/** Atributos `data-*` que marcam os pontos de origem e destino dos voos. */
export const MARCADORES = {
  /** O monte de cartas no centro/esquerda da mesa, ao lado da vira. */
  baralho: 'data-baralho-central',
  /** Cada carta da minha mão: `data-carta-mao="<id da carta>"`. */
  cartaNaMao: 'data-carta-mao',
  /** Placa de cada adversário: `data-placa-jogador="<id do jogador>"`. */
  placaDoJogador: 'data-placa-jogador',
  /** Cada carta já na mesa: `data-carta-mesa="<id da carta>"`. */
  cartaNaMesa: 'data-carta-mesa',
} as const;

/**
 * Destino do voo de uma vaza toda anulada: o canto da mesa onde ficam os montinhos de empate.
 * Usa o mesmo `data-monte-destino` dos montinhos dos jogadores, com este id no lugar do jogador.
 */
export const DESTINO_DOS_EMPATES = 'empates';

export function seletor(marcador: string, valor?: string): string {
  return valor === undefined ? `[${marcador}]` : `[${marcador}="${CSS.escape(valor)}"]`;
}

export function prefereMenosMovimento(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Quando eu jogo, a carta sai da mão no mesmo estado em que entra na mesa: a mão guarda aqui de
 * onde ela partiu (antes de pedir a jogada) para a mesa conseguir animar o voo.
 */
const origensDasJogadas = new Map<string, DOMRect>();

export function registrarOrigemDaJogada(cartaId: string, origem: DOMRect): void {
  origensDasJogadas.set(cartaId, origem);
}

export function retirarOrigemDaJogada(cartaId: string): DOMRect | undefined {
  const origem = origensDasJogadas.get(cartaId);
  origensDasJogadas.delete(cartaId);
  return origem;
}
