import { NAIPES, ehCartaOculta, type Carta, type Valor } from '@fodinha/shared';
import type { JogadorNaVisao, VisaoDaPartida } from '../projecao';
import { forca, vivos, type Contexto } from './leitura-da-mesa';

// Probabilidade estimada de uma manilha vencer a vaza: sobe com o naipe (ouros → paus).
const CHANCE_MANILHA_MAIS_FRACA = 0.7;
const ACRESCIMO_CHANCE_POR_NAIPE = 0.09;
const CHANCE_MAXIMA = 0.97;

// Cartas comuns só pesam perto do topo da escala: abaixo desse corte valem ~0 vazas.
const CORTE_RELATIVO_COMUM = 0.6;
const CHANCE_MAXIMA_COMUM = 0.4;

// Com poucos adversários uma carta alta vale mais; com muitos, vale menos (4 jogadores = neutro).
const JOGADORES_NEUTROS = 4;
const FATOR_MAXIMO_POR_MESA_PEQUENA = 1.5;

// Quanto o bot desconta do próprio palpite por vaza que a mesa já pediu acima da média.
const PESO_DOS_PALPITES_DA_MESA = 0.35;

// Rodada cega: o que os palpites dos outros (que veem a carta do bot) dizem sobre ela.
const DESCONTO_POR_QUEM_PEDIU_1 = 0.65;
const ACRESCIMO_POR_ZERO_SEM_MOTIVO = 0.35;
// Um 0 só se explica pela carta do bot se o resto que o palpiteiro via era fraco.
const CORTE_RELATIVO_CARTA_FRACA = 0.5;

/** Chance estimada de a carta, sozinha, levar uma vaza contra `adversarios` jogadores. */
function chanceDeVencer(carta: Carta, contexto: Contexto, adversarios: number): number {
  const nivel = forca(carta, contexto);
  if (carta.valor === contexto.manilha) {
    const naipe = nivel - contexto.valores.length;
    return Math.min(CHANCE_MAXIMA, CHANCE_MANILHA_MAIS_FRACA + naipe * ACRESCIMO_CHANCE_POR_NAIPE);
  }
  const relativa = nivel / (contexto.valores.length - 1);
  const acimaDoCorte = Math.max(0, (relativa - CORTE_RELATIVO_COMUM) / (1 - CORTE_RELATIVO_COMUM));
  const fatorDeMesa = Math.min(
    FATOR_MAXIMO_POR_MESA_PEQUENA,
    JOGADORES_NEUTROS / (adversarios + 1),
  );
  return Math.min(CHANCE_MAXIMA, acimaDoCorte ** 2 * CHANCE_MAXIMA_COMUM * fatorDeMesa);
}

function outrosQueJaPalpitaram(visao: VisaoDaPartida, jogadorId: string): JogadorNaVisao[] {
  return vivos(visao).filter((jogador) => jogador.id !== jogadorId && jogador.palpite !== null);
}

/**
 * Vazas esperadas, sem arredondar: o arredondamento fica para quem escolhe entre os permitidos,
 * para o pé cair no lado mais provável quando o número ideal é proibido.
 */
export function vazasEsperadas(
  visao: VisaoDaPartida,
  jogadorId: string,
  contexto: Contexto,
): number {
  const adversarios = vivos(visao).length - 1;
  const pelasCartas = visao.minhaMao
    .filter((carta): carta is Carta => !ehCartaOculta(carta))
    .reduce((soma, carta) => soma + chanceDeVencer(carta, contexto, adversarios), 0);

  // Mesa que pediu muito vai disputar as vazas; mesa que pediu pouco deixa sobrar.
  const outros = outrosQueJaPalpitaram(visao, jogadorId);
  const mediaPorJogador = visao.cartasPorJogador / vivos(visao).length;
  const pedido = outros.reduce((soma, jogador) => soma + (jogador.palpite ?? 0), 0);
  const excesso = pedido - outros.length * mediaPorJogador;
  const ajustado = pelasCartas - excesso * PESO_DOS_PALPITES_DA_MESA;
  return Math.min(visao.cartasPorJogador, Math.max(0, ajustado));
}

// ---------------------------------------------------------------------------------------------
// Rodada cega
// ---------------------------------------------------------------------------------------------

/** Cartas que ainda podem estar na própria testa: o baralho menos o que o bot enxerga. */
function cartasPossiveisParaMim(visao: VisaoDaPartida, valores: readonly Valor[]): Carta[] {
  const conhecidas = [
    ...(visao.vira ? [visao.vira] : []),
    ...visao.jogadores
      .map((jogador) => jogador.cartaNaTesta)
      .filter((carta): carta is Carta => carta !== null),
  ];
  const possiveis: Carta[] = [];
  for (let baralho = 0; baralho < visao.configuracao.quantidadeBaralhos; baralho++) {
    for (const valor of valores) {
      for (const naipe of NAIPES) possiveis.push({ id: '', valor, naipe });
    }
  }
  for (const conhecida of conhecidas) {
    const posicao = possiveis.findIndex(
      (carta) => carta.valor === conhecida.valor && carta.naipe === conhecida.naipe,
    );
    if (posicao >= 0) possiveis.splice(posicao, 1);
  }
  return possiveis;
}

/** Chance de a carta oculta vencer (sem empatar com ninguém) entre as que ainda podem existir. */
function chancePelasCartasVisiveis(visao: VisaoDaPartida, contexto: Contexto): number {
  const forcas = visao.jogadores
    .map((jogador) => jogador.cartaNaTesta)
    .filter((carta): carta is Carta => carta !== null)
    .map((carta) => forca(carta, contexto));
  const contagem = (nivel: number) => forcas.filter((f) => f === nivel).length;
  const maiorValendo = Math.max(-1, ...forcas.filter((f) => contagem(f) === 1));

  const possiveis = cartasPossiveisParaMim(visao, contexto.valores);
  if (possiveis.length === 0) return 0;
  // Igualar uma carta já visível a anula (ou forma trio, que também se anula).
  const vencedoras = possiveis.filter((carta) => {
    const nivel = forca(carta, contexto);
    return nivel > maiorValendo && !forcas.includes(nivel);
  });
  return vencedoras.length / possiveis.length;
}

/**
 * Os outros veem a carta do bot. Quem pediu 1 achou que ela perde para a dele; quem pediu 0
 * vendo só cartas fracas além da do bot provavelmente desistiu por causa dela.
 */
export function chanceNaRodadaCega(
  visao: VisaoDaPartida,
  jogadorId: string,
  contexto: Contexto,
): number {
  let chance = chancePelasCartasVisiveis(visao, contexto);
  const corte = CORTE_RELATIVO_CARTA_FRACA * (contexto.valores.length - 1);
  for (const outro of outrosQueJaPalpitaram(visao, jogadorId)) {
    if (outro.palpite === 1) {
      chance *= DESCONTO_POR_QUEM_PEDIU_1;
      continue;
    }
    const maiorQueEleViaSemMim = Math.max(
      -1,
      ...visao.jogadores
        .filter((jogador) => jogador.id !== outro.id && jogador.cartaNaTesta !== null)
        .map((jogador) => forca(jogador.cartaNaTesta as Carta, contexto)),
    );
    if (maiorQueEleViaSemMim < corte) chance += (1 - chance) * ACRESCIMO_POR_ZERO_SEM_MOTIVO;
  }
  return chance;
}
