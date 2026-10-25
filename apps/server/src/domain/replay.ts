import type { ConfiguracaoPartida, EstadoPartidaVisivel } from '@fodinha/shared';
import type { MotivoDoFim, RodadaDoDiario } from './diario';
import { ErroDeRegra } from './erros';
import type { Partida } from './partida';
import { HERANCA_DA_PRIMEIRA_RODADA, reencenarRodada, type HerancaDaRodada } from './reconstrucao';

/**
 * Replay de uma partida terminada: cada rodada do diário é reencenada numa `Partida` e, depois de
 * cada ação, a mesa é projetada para quem revê. A regra de quem vê o quê continua em `projetarPara`
 * (com o momento `depoisDoFim`): aqui nada recalcula força, vaza ou vida.
 */

/** Como o assento aparece na mesa do replay; o diário não guarda apelido (P4). */
export interface AssentoNoReplay {
  readonly apelido: string;
  readonly ehBot: boolean;
}

export interface PedidoDeReplay {
  readonly configuracao: ConfiguracaoPartida;
  /** O desfecho gravado; só `fim` tem replay (premissa P8). `null` = em andamento ou perdida. */
  readonly motivoDoFim: MotivoDoFim | null;
  /** As rodadas de 1 até a pedida, completas e em ordem. */
  readonly rodadas: readonly RodadaDoDiario[];
  /** O assento de quem revê. Fora da rodada (entrou depois ou já saiu), ele assiste de fora. */
  readonly observadorId: string;
  readonly assentos: ReadonlyMap<string, AssentoNoReplay>;
}

const ASSENTO_DESCONHECIDO: AssentoNoReplay = { apelido: 'Jogador', ehBot: false };

/**
 * A mão alheia só se mostra depois do fim (P8): com a partida interrompida, abandonada ou ainda
 * correndo, o replay simplesmente não existe.
 */
export function exigirPartidaTerminada(motivoDoFim: MotivoDoFim | null): void {
  if (motivoDoFim === 'fim') return;
  throw new ErroDeRegra('SEM_PERMISSAO', 'Só partidas terminadas têm replay.');
}

function lanceDa(partida: Partida, pedido: PedidoDeReplay): EstadoPartidaVisivel {
  const observador = partida.participa(pedido.observadorId) ? pedido.observadorId : null;
  const visao = partida.visaoPara(observador, 'depoisDoFim');
  const previsao = partida.previsaoDaProximaRodada();
  return {
    ...visao,
    // Ninguém corre contra o relógio no replay: quem dita o ritmo é o controle de quem revê.
    prazoDaVezEm: null,
    prazoDaVezRestanteMs: null,
    proximaRodada: previsao && { ...previsao, comecaEmMs: null },
    pausa: null,
    jogadores: visao.jogadores.map((jogador) => ({
      ...jogador,
      ...(pedido.assentos.get(jogador.id) ?? ASSENTO_DESCONHECIDO),
      conectado: true,
    })),
  };
}

/**
 * Os lances da última rodada de `pedido.rodadas`: a mesa recém-distribuída e a mesa depois de
 * cada palpite e de cada carta. As anteriores só são reencenadas pelo que deixam à vista.
 */
export function lancesDaRodada(pedido: PedidoDeReplay): EstadoPartidaVisivel[] {
  exigirPartidaTerminada(pedido.motivoDoFim);
  const alvo = pedido.rodadas[pedido.rodadas.length - 1];
  if (!alvo) throw new ErroDeRegra('ENTRADA_INVALIDA', 'Nenhuma rodada para rever.');
  let heranca: HerancaDaRodada = HERANCA_DA_PRIMEIRA_RODADA;
  pedido.rodadas.forEach((rodada, indice) => {
    if (rodada.numero !== indice + 1) {
      throw new ErroDeRegra('ENTRADA_INVALIDA', `Falta a rodada ${indice + 1} do diário.`);
    }
    if (indice === pedido.rodadas.length - 1) return;
    heranca = reencenarRodada(pedido.configuracao, rodada, heranca).heranca;
  });

  const lances: EstadoPartidaVisivel[] = [];
  reencenarRodada(pedido.configuracao, alvo, heranca, {
    aoAbrir: (partida) => lances.push(lanceDa(partida, pedido)),
    depoisDeAgir: (partida) => lances.push(lanceDa(partida, pedido)),
  });
  return lances;
}
