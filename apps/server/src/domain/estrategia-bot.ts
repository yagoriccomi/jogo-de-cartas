import { ehCartaOculta, type Carta, type Valor } from '@fodinha/shared';
import { valoresEmJogo } from './baralho';
import { forcaDaCarta } from './forca';
import type { VisaoDaPartida } from './partida';

/**
 * Estratégia do bot. Recebe apenas a visão que um jogador humano teria — o bot não trapaceia.
 * Também é usada para jogar automaticamente por quem estourou o prazo da vez.
 */
export interface EstrategiaDeJogo {
  escolherPalpite(visao: VisaoDaPartida, palpitesPermitidos: readonly number[]): number;
  escolherCarta(visao: VisaoDaPartida, jogadorId: string): string;
}

interface Contexto {
  readonly manilha: Valor;
  readonly valores: readonly Valor[];
  readonly forcaMaxima: number;
}

function contextoDe(visao: VisaoDaPartida): Contexto {
  const valores = valoresEmJogo(visao.configuracao.incluirOitoNoveDez);
  // A manilha mais forte (paus) fica 3 posições acima do total de valores comuns.
  return { manilha: visao.manilha as Valor, valores, forcaMaxima: valores.length + 3 };
}

function forca(carta: Carta, contexto: Contexto): number {
  return forcaDaCarta(carta, contexto.manilha, contexto.valores);
}

function maisProximoPermitido(desejado: number, permitidos: readonly number[]): number {
  return [...permitidos].sort(
    (a, b) => Math.abs(a - desejado) - Math.abs(b - desejado) || a - b,
  )[0] as number;
}

export class EstrategiaSimples implements EstrategiaDeJogo {
  escolherPalpite(visao: VisaoDaPartida, palpitesPermitidos: readonly number[]): number {
    const contexto = contextoDe(visao);
    const adversarios = visao.jogadores.filter((jogador) => !jogador.eliminado).length - 1;

    if (visao.rodadaCega) {
      return maisProximoPermitido(this.palpiteCego(visao, contexto), palpitesPermitidos);
    }

    // Chance de cada carta vencer ≈ (força relativa) ^ adversários; somada, estima as vazas.
    const vazasEsperadas = visao.minhaMao
      .filter((carta): carta is Carta => !ehCartaOculta(carta))
      .reduce(
        (soma, carta) => soma + (forca(carta, contexto) / contexto.forcaMaxima) ** adversarios,
        0,
      );
    return maisProximoPermitido(Math.round(vazasEsperadas), palpitesPermitidos);
  }

  escolherCarta(visao: VisaoDaPartida, jogadorId: string): string {
    const mao = visao.minhaMao;
    if (visao.rodadaCega || mao.some(ehCartaOculta)) return (mao[0] as { id: string }).id;

    const contexto = contextoDe(visao);
    const cartas = [...(mao as Carta[])].sort((a, b) => forca(a, contexto) - forca(b, contexto));
    const eu = visao.jogadores.find((jogador) => jogador.id === jogadorId);
    const querVencer = (eu?.vazasFeitas ?? 0) < (eu?.palpite ?? 0);
    const maiorNaMesa = Math.max(-1, ...visao.mesa.map(({ carta }) => forca(carta, contexto)));
    const vencedoras = cartas.filter((carta) => forca(carta, contexto) > maiorNaMesa);
    const perdedoras = cartas.filter((carta) => forca(carta, contexto) <= maiorNaMesa);
    const maisFraca = cartas[0] as Carta;
    const maisForte = cartas[cartas.length - 1] as Carta;

    if (querVencer) {
      if (visao.mesa.length === 0) return maisForte.id;
      return (vencedoras[0] ?? maisFraca).id;
    }
    // Não quer vencer: descarta a maior carta que ainda perde, preservando as fracas para depois.
    return (perdedoras[perdedoras.length - 1] ?? maisFraca).id;
  }

  /** Na rodada cega o bot só vê as cartas dos outros: aposta 1 se nenhuma delas for alta. */
  private palpiteCego(visao: VisaoDaPartida, contexto: Contexto): number {
    const maiorVisivel = Math.max(
      -1,
      ...visao.jogadores
        .map((jogador) => jogador.cartaNaTesta)
        .filter((carta): carta is Carta => carta !== null)
        .map((carta) => forca(carta, contexto)),
    );
    return maiorVisivel < contexto.valores.length / 2 ? 1 : 0;
  }
}
