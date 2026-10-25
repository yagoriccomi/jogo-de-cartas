import type {
  Carta,
  ConfiguracaoPartida,
  ResultadoJogadorNaRodada,
  VazaResolvida,
} from '@fodinha/shared';
import type { AutorDaDecisao, RodadaDoDiario } from './diario';
import { ErroDeRegra } from './erros';
import { Partida } from './partida';
import type { OcorrenciaDaRodada } from './partida';
import type { VisaoDaPartida } from './projecao';

/**
 * Refaz, a partir do diário, o que cada jogador via em cada decisão. A rodada é reencenada numa
 * `Partida` e a visão sai de `visaoPara`: a regra de quem vê o quê continua num lugar só, e uma
 * mudança na projeção vale para o export sem reescrever nada aqui.
 */

export type AcaoReconstruida =
  | { readonly tipo: 'palpite'; readonly quantidade: number }
  | { readonly tipo: 'carta'; readonly carta: Carta; readonly vaza: number };

export interface DecisaoReconstruida {
  /** Posição da decisão dentro da rodada (palpites primeiro, depois as cartas). */
  readonly ordem: number;
  readonly jogadorId: string;
  readonly autor: AutorDaDecisao;
  /** O recorte de `projetarPara` para quem decidiu, no instante antes de agir. */
  readonly visao: VisaoDaPartida;
  readonly acao: AcaoReconstruida;
}

/** O que uma rodada deixa à vista durante a seguinte. */
export interface HerancaDaRodada {
  readonly ultimaVaza: VazaResolvida | null;
  readonly resultado: readonly ResultadoJogadorNaRodada[] | null;
}

export const HERANCA_DA_PRIMEIRA_RODADA: HerancaDaRodada = { ultimaVaza: null, resultado: null };

export interface RodadaReconstruida {
  readonly decisoes: readonly DecisaoReconstruida[];
  /** Entra na reconstrução da rodada seguinte. */
  readonly heranca: HerancaDaRodada;
}

function aplicar(partida: Partida, ocorrencia: OcorrenciaDaRodada): void {
  // O destino da saída não aparece na visão durante a rodada: basta marcar quem sai.
  if (ocorrencia.tipo === 'saida') partida.agendarSaida(ocorrencia.jogadorId, 'eliminar');
  else partida.definirMortosVeemCartas(ocorrencia.valor);
}

function exigirMesmoResultado(partida: Partida, rodada: RodadaDoDiario): void {
  const refeito = partida.visaoPara(null).resultadoRodada ?? [];
  const gravado = rodada.resultado.map(({ jogadorId, palpite, vazasFeitas, vidasPerdidas }) => ({
    jogadorId,
    palpite,
    vazasFeitas,
    vidasPerdidas,
  }));
  if (JSON.stringify(refeito) !== JSON.stringify(gravado)) {
    throw new ErroDeRegra(
      'ENTRADA_INVALIDA',
      `A rodada ${rodada.numero} do diário não fecha com as regras.`,
    );
  }
}

/**
 * Quem acompanha a reencenação: `antesDeAgir` vê a mesa no instante da decisão (o export de
 * treino), `depoisDeAgir` vê a mesa que a ação deixou (o replay).
 */
export interface OuvinteDaReencenacao {
  /** A mesa recém-distribuída, antes de qualquer ação. */
  aoAbrir?(partida: Partida): void;
  antesDeAgir?(partida: Partida, decisao: Omit<DecisaoReconstruida, 'ordem' | 'visao'>): void;
  depoisDeAgir?(partida: Partida): void;
}

export interface RodadaReencenada {
  /** A partida como a última ação da rodada a deixou (fim da rodada ou partida encerrada). */
  readonly partida: Partida;
  readonly heranca: HerancaDaRodada;
}

/**
 * Repõe a rodada numa `Partida` e refaz cada ação do diário, na ordem, avisando o ouvinte. Lança
 * `ErroDeRegra` quando o diário não é coerente com as regras (jogada fora da vez, carta que não
 * estava na mão, resultado diferente do gravado).
 */
export function reencenarRodada(
  configuracao: ConfiguracaoPartida,
  rodada: RodadaDoDiario,
  heranca: HerancaDaRodada,
  ouvinte: OuvinteDaReencenacao = {},
): RodadaReencenada {
  const partida = Partida.reencenar({
    configuracao: { ...configuracao, mortosVeemCartas: rodada.mortosVeemCartas },
    numero: rodada.numero,
    cartasPorJogador: rodada.cartasPorJogador,
    vira: rodada.vira,
    idDoPe: rodada.idDoPe,
    jogadores: rodada.jogadores,
    ultimaVaza: heranca.ultimaVaza,
    resultadoAnterior: heranca.resultado,
  });
  ouvinte.aoAbrir?.(partida);
  const pendentes = [...rodada.ocorrencias].sort((a, b) => a.depoisDe - b.depoisDe);
  let feitas = 0;

  const agir = (
    jogadorId: string,
    autor: AutorDaDecisao | null,
    acao: AcaoReconstruida,
    executar: () => void,
  ) => {
    while (pendentes[0] && pendentes[0].depoisDe <= feitas) {
      aplicar(partida, pendentes.shift() as OcorrenciaDaRodada);
    }
    if (autor) ouvinte.antesDeAgir?.(partida, { jogadorId, autor, acao });
    executar();
    feitas += 1;
    ouvinte.depoisDeAgir?.(partida);
  };

  for (const { jogadorId, quantidade, autor } of rodada.palpites) {
    agir(jogadorId, autor, { tipo: 'palpite', quantidade }, () =>
      partida.palpitar(jogadorId, quantidade),
    );
  }
  // Na rodada cega o último palpite já levou todas as cartas à mesa: não há o que refazer.
  if (!rodada.cega) {
    rodada.vazas.forEach((vaza, indice) => {
      for (const { jogadorId, carta, autor } of vaza.jogadas) {
        agir(jogadorId, autor, { tipo: 'carta', carta, vaza: indice + 1 }, () =>
          partida.jogarCarta(jogadorId, carta.id),
        );
      }
    });
  }
  exigirMesmoResultado(partida, rodada);
  const { ultimaVaza, resultadoRodada } = partida.visaoPara(null);
  return { partida, heranca: { ultimaVaza, resultado: resultadoRodada } };
}

/** Uma rodada, dada a configuração da partida e a herança da rodada anterior. */
export function reconstruirRodada(
  configuracao: ConfiguracaoPartida,
  rodada: RodadaDoDiario,
  heranca: HerancaDaRodada,
): RodadaReconstruida {
  const decisoes: DecisaoReconstruida[] = [];
  const reencenada = reencenarRodada(configuracao, rodada, heranca, {
    antesDeAgir: (partida, { jogadorId, autor, acao }) => {
      const visao = partida.visaoPara(jogadorId);
      decisoes.push({ ordem: decisoes.length, jogadorId, autor, visao, acao });
    },
  });
  return { decisoes, heranca: reencenada.heranca };
}

/** A partida inteira, rodada a rodada; as rodadas precisam vir completas e em ordem desde a 1ª. */
export function reconstruirPartida(
  configuracao: ConfiguracaoPartida,
  rodadas: readonly RodadaDoDiario[],
): RodadaReconstruida[] {
  let heranca = HERANCA_DA_PRIMEIRA_RODADA;
  return rodadas.map((rodada, indice) => {
    if (rodada.numero !== indice + 1) {
      throw new ErroDeRegra('ENTRADA_INVALIDA', `Falta a rodada ${indice + 1} do diário.`);
    }
    const reconstruida = reconstruirRodada(configuracao, rodada, heranca);
    heranca = reconstruida.heranca;
    return reconstruida;
  });
}
