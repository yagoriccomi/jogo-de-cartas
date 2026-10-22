import { NAIPES, ehCartaOculta, type Carta, type Jogada, type Valor } from '@fodinha/shared';
import { valoresEmJogo } from '../../src/domain/baralho';
import { forcaDaCarta } from '../../src/domain/forca';
import type { EstrategiaDeJogo } from '../../src/domain/estrategia-bot';
import type { VisaoDaPartida } from '../../src/domain/projecao';
import { resolverVaza } from '../../src/domain/vaza';

/**
 * Bot anterior à revisão de 2026-10 (`answers/2026_10_22 bot-situacoes 001.md`). Fica só nos testes,
 * como adversário de referência da simulação que mede se o bot novo perde menos vidas.
 */

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

// Na rodada cega só se arrisca 1 se a chance de a carta oculta vencer passar de metade.
const CHANCE_MINIMA_RODADA_CEGA = 0.5;

interface Contexto {
  readonly manilha: Valor;
  readonly valores: readonly Valor[];
}

function contextoDe(visao: VisaoDaPartida): Contexto {
  return {
    manilha: visao.manilha as Valor,
    valores: valoresEmJogo(visao.configuracao.incluirOitoNoveDez),
  };
}

function forca(carta: Carta, contexto: Contexto): number {
  return forcaDaCarta(carta, contexto.manilha, contexto.valores);
}

function maisProximoPermitido(desejado: number, permitidos: readonly number[]): number {
  return [...permitidos].sort(
    (a, b) => Math.abs(a - desejado) - Math.abs(b - desejado) || a - b,
  )[0] as number;
}

function adversariosVivos(visao: VisaoDaPartida): number {
  return visao.jogadores.filter((jogador) => !jogador.eliminado).length - 1;
}

/** Ordem estável (força e depois id): o mesmo estado sempre gera a mesma escolha. */
function ordenarPorForca(cartas: readonly Carta[], contexto: Contexto): Carta[] {
  return [...cartas].sort(
    (a, b) => forca(a, contexto) - forca(b, contexto) || a.id.localeCompare(b.id),
  );
}

// ---------------------------------------------------------------------------------------------
// Palpite
// ---------------------------------------------------------------------------------------------

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

/**
 * Rodada cega: todos os outros estão visíveis, então dá para calcular a chance de a carta
 * oculta vencer (sem empatar com ninguém) entre as que ainda podem existir.
 */
function palpiteCego(visao: VisaoDaPartida, contexto: Contexto): number {
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
  return vencedoras.length / possiveis.length > CHANCE_MINIMA_RODADA_CEGA ? 1 : 0;
}

// ---------------------------------------------------------------------------------------------
// Jogada
// ---------------------------------------------------------------------------------------------

/** Simula colocar a carta na mesa usando a mesma regra de resolução da partida. */
function venceriaAgora(
  carta: Carta,
  jogadorId: string,
  visao: VisaoDaPartida,
  contexto: Contexto,
): boolean {
  const jogadas: Jogada[] = [...visao.mesa, { jogadorId, carta }];
  return resolverVaza(jogadas, contexto.manilha, contexto.valores) === jogadorId;
}

function abrirVaza(cartasEmOrdem: readonly Carta[], faltam: number): Carta {
  const maisFraca = cartasEmOrdem[0] as Carta;
  const maisForte = cartasEmOrdem[cartasEmOrdem.length - 1] as Carta;
  // Já acertou o palpite: abre baixo para não levar a vaza (cartas fracas também se anulam).
  if (faltam <= 0) return maisFraca;
  // Precisa de todas as vazas que restam: usa a melhor carta antes que algo a anule.
  if (faltam >= cartasEmOrdem.length) return maisForte;
  // Sobra carta: abre com a do meio, guardando a mais forte para vaza em que ela decida.
  return cartasEmOrdem[Math.floor(cartasEmOrdem.length / 2)] as Carta;
}

export class EstrategiaAnterior implements EstrategiaDeJogo {
  escolherPalpite(visao: VisaoDaPartida, palpitesPermitidos: readonly number[]): number {
    const contexto = contextoDe(visao);
    if (visao.rodadaCega) {
      return maisProximoPermitido(palpiteCego(visao, contexto), palpitesPermitidos);
    }

    const adversarios = adversariosVivos(visao);
    const vazasEsperadas = visao.minhaMao
      .filter((carta): carta is Carta => !ehCartaOculta(carta))
      .reduce((soma, carta) => soma + chanceDeVencer(carta, contexto, adversarios), 0);
    return maisProximoPermitido(Math.round(vazasEsperadas), palpitesPermitidos);
  }

  escolherCarta(visao: VisaoDaPartida, jogadorId: string): string {
    const mao = visao.minhaMao;
    if (visao.rodadaCega || mao.some(ehCartaOculta)) return (mao[0] as { id: string }).id;

    const contexto = contextoDe(visao);
    const cartas = ordenarPorForca(mao as Carta[], contexto);
    const maisFraca = cartas[0] as Carta;
    const eu = visao.jogadores.find((jogador) => jogador.id === jogadorId);
    const faltam = (eu?.palpite ?? 0) - (eu?.vazasFeitas ?? 0);

    if (visao.mesa.length === 0) return abrirVaza(cartas, faltam).id;

    const vencedoras = cartas.filter((carta) => venceriaAgora(carta, jogadorId, visao, contexto));
    if (faltam > 0) return (vencedoras[0] ?? maisFraca).id;

    // Palpite cumprido: descarta a maior carta que não leva a vaza, guardando as fracas.
    const perdedoras = cartas.filter((carta) => !vencedoras.includes(carta));
    return (perdedoras[perdedoras.length - 1] ?? maisFraca).id;
  }
}
