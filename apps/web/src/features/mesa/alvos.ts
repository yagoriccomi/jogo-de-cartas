import { MARCADORES } from './animacao-compartilhada';

/**
 * Áreas da mesa que alguém de fora aponta (os balões do tutorial): `data-alvo="<área>"`. Marcador
 * em vez de classe CSS para que renomear um estilo não deixe um balão sem alvo.
 */
export const ATRIBUTO_DE_ALVO = 'data-alvo';

export const ALVOS = {
  adversarios: 'adversarios',
  /** Coluna da vira, da manilha e do baralho. */
  viraEManilha: 'vira-e-manilha',
  cartasNaMesa: 'cartas-na-mesa',
  palpite: 'palpite',
  resultado: 'resultado',
  /** A minha barra e a minha mão; dentro dela, `numeros` e `simbolos` são os meus. */
  minhaArea: 'minha-area',
  /** "Pediu / Fez" de um jogador (na placa ou na minha barra). */
  numeros: 'numeros',
  /** Símbolos de mão e pé de um jogador. */
  simbolos: 'simbolos',
  simboloDaMao: 'simbolo-da-mao',
  /** Rodada cega: a carta na testa de um adversário. */
  testa: 'testa',
  /** Celular: a alça que abre o topo recolhido. */
  alcaDoTopo: 'alca-do-topo',
  /** Computador: os botões do topo (placar, regras, menu). */
  acoesDoTopo: 'acoes-do-topo',
} as const;

export type Alvo = (typeof ALVOS)[keyof typeof ALVOS];

/** Para espalhar no elemento: `<div {...marcarAlvo(ALVOS.palpite)}>`. */
export function marcarAlvo(alvo: Alvo): Record<typeof ATRIBUTO_DE_ALVO, Alvo> {
  return { [ATRIBUTO_DE_ALVO]: alvo };
}

/** Aspas e barras escapadas à mão: o roteiro monta os seletores também fora do navegador. */
function seletorDeAtributo(atributo: string, valor: string): string {
  return `[${atributo}="${valor.replace(/["\\]/g, '\\$&')}"]`;
}

/** Seletor de uma área; várias em sequência descem uma dentro da outra. */
export function seletorDeAlvo(...alvos: readonly Alvo[]): string {
  return alvos.map((alvo) => seletorDeAtributo(ATRIBUTO_DE_ALVO, alvo)).join(' ');
}

export function seletorDaPlaca(jogadorId: string, ...dentro: readonly Alvo[]): string {
  const placa = seletorDeAtributo(MARCADORES.placaDoJogador, jogadorId);
  return dentro.length === 0 ? placa : `${placa} ${seletorDeAlvo(...dentro)}`;
}

export function seletorDaCartaNaMao(cartaId: string): string {
  return seletorDeAtributo(MARCADORES.cartaNaMao, cartaId);
}
