import { ehCartaOculta, type Carta } from '@fodinha/shared';
import type { GeradorAleatorio } from './aleatoriedade';
import { escolherJogada } from './bot/jogada';
import { contextoDe, forca, ordenarPorForca } from './bot/leitura-da-mesa';
import { chanceNaRodadaCega, vazasEsperadas } from './bot/palpite';
import {
  AJUSTES_DOS_PERFIS,
  PERFIS_DE_BOT,
  type AjustesDoPerfil,
  type PerfilDeBot,
} from './bot/perfis';
import type { VisaoDaPartida } from './projecao';

/**
 * Estratégia do bot. Recebe apenas a visão que um humano teria — o bot não trapaceia.
 * Também joga por quem estourou o prazo da vez. Regras: `answers/2026_10_22 bot-situacoes 001.md`.
 */
export interface EstrategiaDeJogo {
  escolherPalpite(
    visao: VisaoDaPartida,
    jogadorId: string,
    palpitesPermitidos: readonly number[],
  ): number;
  escolherCarta(visao: VisaoDaPartida, jogadorId: string): string;
}

export type EstrategiasDosPerfis = Readonly<Record<PerfilDeBot, EstrategiaDeJogo>>;

/** Um cérebro por perfil, todos com o mesmo sorteio de erro. */
export function criarEstrategiasDosPerfis(gerarAleatorio: GeradorAleatorio): EstrategiasDosPerfis {
  const estrategias = {} as Record<PerfilDeBot, EstrategiaDeJogo>;
  for (const perfil of PERFIS_DE_BOT) {
    estrategias[perfil] = new EstrategiaDoBot(gerarAleatorio, perfil);
  }
  return estrategias;
}

// Distância a mais (em vazas) que o segundo palpite pode ter para ainda valer como dúvida.
const MARGEM_DE_DUVIDA_NO_PALPITE = 0.3;

/** Permitidos do mais próximo ao mais distante do desejado; empate fica com o menor. */
function permitidosPorProximidade(desejado: number, permitidos: readonly number[]): number[] {
  return [...permitidos].sort((a, b) => Math.abs(a - desejado) - Math.abs(b - desejado) || a - b);
}

/**
 * O perfil só ajusta números (`bot/perfis.ts`): a leitura da mesa e a escada são as mesmas para todos.
 * O erro vai para a segunda melhor decisão, para o bot não jogar igual sempre.
 */
export class EstrategiaDoBot implements EstrategiaDeJogo {
  private readonly ajustes: AjustesDoPerfil;

  constructor(
    private readonly gerarAleatorio: GeradorAleatorio,
    perfil: PerfilDeBot = 'equilibrado',
  ) {
    this.ajustes = AJUSTES_DOS_PERFIS[perfil];
  }

  escolherPalpite(
    visao: VisaoDaPartida,
    jogadorId: string,
    palpitesPermitidos: readonly number[],
  ): number {
    const contexto = contextoDe(visao);
    const desejado = visao.rodadaCega
      ? chanceNaRodadaCega(visao, jogadorId, contexto)
      : vazasEsperadas(visao, jogadorId, contexto, this.ajustes);
    const [melhor, segundo] = permitidosPorProximidade(desejado, palpitesPermitidos);
    if (segundo === undefined || !this.errou()) return melhor as number;
    // Só erra na dúvida: com poucas cartas, trocar um palpite claro custa uma vida quase sempre.
    const duvida = Math.abs(segundo - desejado) - Math.abs((melhor as number) - desejado);
    return duvida <= MARGEM_DE_DUVIDA_NO_PALPITE ? segundo : (melhor as number);
  }

  escolherCarta(visao: VisaoDaPartida, jogadorId: string): string {
    const mao = visao.minhaMao;
    if (visao.rodadaCega || mao.some(ehCartaOculta)) return (mao[0] as { id: string }).id;

    const contexto = contextoDe(visao);
    const escolhida = escolherJogada(
      { visao, jogadorId, mao: mao as Carta[], contexto },
      this.ajustes,
    );
    if (!this.errou()) return escolhida.id;
    // A segunda melhor fica perto da escolhida: a vizinha mais fraca, ou a mais forte se não houver.
    const cartas = ordenarPorForca(mao as Carta[], contexto);
    const posicao = cartas.findIndex((carta) => carta.id === escolhida.id);
    const vizinha = cartas[posicao - 1] ?? cartas[posicao + 1] ?? escolhida;
    return forca(vizinha, contexto) === forca(escolhida, contexto) ? escolhida.id : vizinha.id;
  }

  private errou(): boolean {
    return this.gerarAleatorio() < this.ajustes.chanceDeErro;
  }
}
