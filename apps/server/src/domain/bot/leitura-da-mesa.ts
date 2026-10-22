import { NAIPES, type Carta, type JogadaNaMesa, type Valor } from '@fodinha/shared';
import { valoresEmJogo } from '../baralho';
import { forcaDaCarta } from '../forca';
import type { JogadorNaVisao, VisaoDaPartida } from '../projecao';

/**
 * O que o bot lê da visão antes de decidir. Ele só recebe o que um humano veria e lembra como um
 * jogador bom, mas não perfeito: a última vaza e as manilhas que ficaram à vista no fim das vazas.
 */
export interface Contexto {
  readonly manilha: Valor;
  readonly valores: readonly Valor[];
  readonly quantidadeBaralhos: number;
}

export function contextoDe(visao: VisaoDaPartida): Contexto {
  return {
    manilha: visao.manilha as Valor,
    valores: valoresEmJogo(visao.configuracao.incluirOitoNoveDez),
    quantidadeBaralhos: visao.configuracao.quantidadeBaralhos,
  };
}

export function forca(carta: Carta, contexto: Contexto): number {
  return forcaDaCarta(carta, contexto.manilha, contexto.valores);
}

/** Da mais fraca para a mais forte; o id desempata para o mesmo estado gerar a mesma escolha. */
export function ordenarPorForca(cartas: readonly Carta[], contexto: Contexto): Carta[] {
  return [...cartas].sort(
    (a, b) => forca(a, contexto) - forca(b, contexto) || a.id.localeCompare(b.id),
  );
}

export function vivos(visao: VisaoDaPartida): JogadorNaVisao[] {
  return visao.jogadores.filter((jogador) => !jogador.eliminado);
}

/** Vazas que ainda faltam para acertar o palpite; negativo quando já passou. */
export function faltamPara(jogador: JogadorNaVisao): number {
  return (jogador.palpite ?? 0) - jogador.vazasFeitas;
}

// ---------------------------------------------------------------------------------------------
// A vaza em andamento
// ---------------------------------------------------------------------------------------------

export interface LeituraDaVaza {
  /** Quantas cartas de cada força já estão na mesa. */
  readonly contagem: ReadonlyMap<number, number>;
  /** Forças que ainda valem (sem par na mesa), da mais forte para a mais fraca. */
  readonly validas: readonly number[];
  /** A carta que está ganhando agora, se alguma vale. */
  readonly lider: JogadaNaMesa | null;
  /** Quem ainda joga nesta vaza depois de mim, na ordem da mesa. */
  readonly porJogar: readonly JogadorNaVisao[];
}

export function lerVaza(
  visao: VisaoDaPartida,
  jogadorId: string,
  contexto: Contexto,
): LeituraDaVaza {
  const contagem = new Map<number, number>();
  for (const { carta } of visao.mesa) {
    const nivel = forca(carta, contexto);
    contagem.set(nivel, (contagem.get(nivel) ?? 0) + 1);
  }
  const validas = [...contagem]
    .filter(([, quantidade]) => quantidade === 1)
    .map(([nivel]) => nivel)
    .sort((a, b) => b - a);
  const lider =
    visao.mesa.find((jogada) => !jogada.anulada && forca(jogada.carta, contexto) === validas[0]) ??
    null;
  return { contagem, validas, lider, porJogar: quemAindaJoga(visao, jogadorId) };
}

/** Quem não jogou nesta vaza: começa vazia para todos, então basta ter carta e não estar na mesa. */
function quemAindaJoga(visao: VisaoDaPartida, jogadorId: string): JogadorNaVisao[] {
  const jogaram = new Set(visao.mesa.map((jogada) => jogada.jogadorId));
  const minhaPosicao = visao.jogadores.findIndex((jogador) => jogador.id === jogadorId);
  const total = visao.jogadores.length;
  const emOrdem = visao.jogadores.map(
    (_, passo) => visao.jogadores[(minhaPosicao + 1 + passo) % total] as JogadorNaVisao,
  );
  return emOrdem.filter(
    (jogador) =>
      jogador.id !== jogadorId &&
      !jogador.eliminado &&
      jogador.cartasNaMao > 0 &&
      !jogaram.has(jogador.id),
  );
}

// ---------------------------------------------------------------------------------------------
// Memória e risco
// ---------------------------------------------------------------------------------------------

/** A `ultimaVaza` atravessa o intervalo entre rodadas: só conta se já houve vaza nesta rodada. */
function houveVazaNestaRodada(visao: VisaoDaPartida): boolean {
  return (
    visao.vazasEmpatadas.length > 0 || visao.jogadores.some((jogador) => jogador.vazasFeitas > 0)
  );
}

/**
 * Cartas cujo paradeiro o bot conhece: a mão, a vira, a mesa, a última vaza inteira e as manilhas
 * que ficaram à vista nos montinhos. Uma manilha que perdeu para outra mais forte some da memória,
 * como acontece com um jogador de verdade.
 */
export function cartasConhecidas(
  visao: VisaoDaPartida,
  mao: readonly Carta[],
  contexto: Contexto,
): Carta[] {
  const conhecidas = new Map<string, Carta>();
  const lembrar = (carta: Carta) => conhecidas.set(carta.id, carta);
  mao.forEach(lembrar);
  if (visao.vira) lembrar(visao.vira);
  visao.mesa.forEach(({ carta }) => lembrar(carta));
  if (!houveVazaNestaRodada(visao)) return [...conhecidas.values()];

  visao.ultimaVaza?.jogadas.forEach(({ carta }) => lembrar(carta));
  const nosMontinhos = [
    ...visao.jogadores.flatMap((jogador) => jogador.vazasGanhas.map((vaza) => vaza.cartaVencedora)),
    ...visao.vazasEmpatadas.map((vaza) => vaza.cartaDoTopo),
  ];
  nosMontinhos.filter((carta) => carta.valor === contexto.manilha).forEach(lembrar);
  return [...conhecidas.values()];
}

/** Cópias de cada força no baralho completo da partida. */
function copiasNoBaralho(nivel: number, contexto: Contexto): number {
  const ehManilha = nivel >= contexto.valores.length;
  return contexto.quantidadeBaralhos * (ehManilha ? 1 : NAIPES.length);
}

/**
 * Chance de nenhum dos que ainda vão jogar ter carta que supere ou anule a minha (força igual ou
 * maior). Não sabe quem tem o quê, só quantas cartas assim ainda podem estar nas mãos.
 */
export function chanceDeSegurar(
  carta: Carta,
  conhecidas: readonly Carta[],
  cartasDosQueFaltam: number,
  contexto: Contexto,
): number {
  const nivel = forca(carta, contexto);
  const maiorNivel = contexto.valores.length + NAIPES.length - 1;
  let ameacas = 0;
  let baralho = 0;
  for (let outro = 0; outro <= maiorNivel; outro++) {
    // A força do valor que virou manilha não existe como carta comum.
    if (outro === contexto.valores.indexOf(contexto.manilha)) continue;
    const copias = copiasNoBaralho(outro, contexto);
    baralho += copias;
    if (outro >= nivel) ameacas += copias;
  }
  const ameacasConhecidas = conhecidas.filter((c) => forca(c, contexto) >= nivel).length;
  const desconhecidas = baralho - conhecidas.length;
  if (desconhecidas <= 0) return 1;
  const chanceDeCadaCarta = Math.max(0, ameacas - ameacasConhecidas) / desconhecidas;
  return (1 - chanceDeCadaCarta) ** cartasDosQueFaltam;
}
