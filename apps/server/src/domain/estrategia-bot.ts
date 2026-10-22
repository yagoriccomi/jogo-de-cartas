import { ehCartaOculta, type Carta } from '@fodinha/shared';
import type { GeradorAleatorio } from './aleatoriedade';
import { escolherJogada } from './bot/jogada';
import { contextoDe, forca, ordenarPorForca } from './bot/leitura-da-mesa';
import { chanceNaRodadaCega, vazasEsperadas } from './bot/palpite';
import type { VisaoDaPartida } from './projecao';

/**
 * Estratégia do bot. Recebe apenas a visão que um humano teria — o bot não trapaceia.
 * Também joga por quem estourou o prazo da vez. Regras: `answers/2026_10_22 bot-situacoes 001.md`.
 */
export interface EstrategiaDeJogo {
  escolherPalpite(visao: VisaoDaPartida, palpitesPermitidos: readonly number[]): number;
  escolherCarta(visao: VisaoDaPartida, jogadorId: string): string;
}

// Uma decisão em cada dez vai para a segunda melhor: o bot não joga igual sempre.
export const CHANCE_DE_ERRO_DO_BOT = 0.1;

/** Permitidos do mais próximo ao mais distante do desejado; empate fica com o menor. */
function permitidosPorProximidade(desejado: number, permitidos: readonly number[]): number[] {
  return [...permitidos].sort((a, b) => Math.abs(a - desejado) - Math.abs(b - desejado) || a - b);
}

export class EstrategiaDoBot implements EstrategiaDeJogo {
  constructor(private readonly gerarAleatorio: GeradorAleatorio) {}

  escolherPalpite(visao: VisaoDaPartida, palpitesPermitidos: readonly number[]): number {
    const jogadorId = visao.idDaVez ?? '';
    const contexto = contextoDe(visao);
    const desejado = visao.rodadaCega
      ? chanceNaRodadaCega(visao, jogadorId, contexto)
      : vazasEsperadas(visao, jogadorId, contexto);
    const [melhor, segundo] = permitidosPorProximidade(desejado, palpitesPermitidos);
    return (this.errou() ? (segundo ?? melhor) : melhor) as number;
  }

  escolherCarta(visao: VisaoDaPartida, jogadorId: string): string {
    const mao = visao.minhaMao;
    if (visao.rodadaCega || mao.some(ehCartaOculta)) return (mao[0] as { id: string }).id;

    const contexto = contextoDe(visao);
    const escolhida = escolherJogada(visao, jogadorId, mao as Carta[], contexto);
    if (!this.errou()) return escolhida.id;
    // A segunda melhor fica perto da escolhida: a vizinha mais fraca, ou a mais forte se não houver.
    const cartas = ordenarPorForca(mao as Carta[], contexto);
    const posicao = cartas.findIndex((carta) => carta.id === escolhida.id);
    const vizinha = cartas[posicao - 1] ?? cartas[posicao + 1] ?? escolhida;
    return forca(vizinha, contexto) === forca(escolhida, contexto) ? escolhida.id : vizinha.id;
  }

  private errou(): boolean {
    return this.gerarAleatorio() < CHANCE_DE_ERRO_DO_BOT;
  }
}
