import { PAUSAS_DO_FIM_DE_RODADA, type EstadoPartidaVisivel } from '@fodinha/shared';

/**
 * Cálculos puros da linha do tempo do replay: onde cada controle leva e quanto o "play" espera
 * em cada lance. Nada aqui busca dados nem toca no armazém.
 */

/** Onde o replay está: rodada a partir de 1, lance a partir de 0. */
export interface PosicaoNoReplay {
  readonly rodada: number;
  readonly lance: number;
}

/** Lance negativo conta do fim: `-1` é o último lance da rodada (resolvido quando ela chega). */
export const ULTIMO_LANCE = -1;

/** Um lance comum no "play": dá tempo de ver a carta voar e quem joga a seguir. */
export const RITMO_DO_LANCE_MS = 1_400;
/** Vaza que acabou de fechar: 3 s parada na mesa e o voo até o montinho (como ao vivo). */
export const PAUSA_DA_VAZA_FECHADA_MS = 4_500;

export const INICIO_DO_REPLAY: PosicaoNoReplay = { rodada: 1, lance: 0 };

export function resolverLance(lance: number, lances: number): number {
  const indice = lance < 0 ? lances + lance : lance;
  return Math.min(Math.max(indice, 0), Math.max(lances - 1, 0));
}

/** `null` = já está no último lance da partida. */
export function proximaPosicao(
  { rodada, lance }: PosicaoNoReplay,
  lancesNaRodada: number,
  totalDeRodadas: number,
): PosicaoNoReplay | null {
  if (lance + 1 < lancesNaRodada) return { rodada, lance: lance + 1 };
  return rodada < totalDeRodadas ? { rodada: rodada + 1, lance: 0 } : null;
}

/** `null` = já está no primeiro lance. Voltar da abertura de uma rodada cai no fim da anterior. */
export function posicaoAnterior({ rodada, lance }: PosicaoNoReplay): PosicaoNoReplay | null {
  if (lance > 0) return { rodada, lance: lance - 1 };
  return rodada > 1 ? { rodada: rodada - 1, lance: ULTIMO_LANCE } : null;
}

/** Começo da próxima rodada; `null` na última. */
export function pularRodada(
  { rodada }: PosicaoNoReplay,
  totalDeRodadas: number,
): PosicaoNoReplay | null {
  return rodada < totalDeRodadas ? { rodada: rodada + 1, lance: 0 } : null;
}

function vazaAcabouDeFechar(lance: EstadoPartidaVisivel, anterior: EstadoPartidaVisivel | null) {
  return lance.fase === 'jogando' && lance.mesa.length === 0 && (anterior?.mesa.length ?? 0) > 0;
}

/**
 * Quanto o "play" espera neste lance antes do próximo. O fim da rodada fica o mesmo tempo que ao
 * vivo (a última vaza e o resultado precisam caber); a vaza fechada, o tempo da cena dela.
 */
export function esperaDoLance(
  lance: EstadoPartidaVisivel,
  anterior: EstadoPartidaVisivel | null,
): number {
  if (lance.fase === 'fim_de_rodada' || lance.fase === 'encerrada') {
    const extra = lance.rodadaCega ? PAUSAS_DO_FIM_DE_RODADA.extraDaRodadaCegaMs : 0;
    return PAUSAS_DO_FIM_DE_RODADA.normalMs + extra;
  }
  return vazaAcabouDeFechar(lance, anterior) ? PAUSA_DA_VAZA_FECHADA_MS : RITMO_DO_LANCE_MS;
}

/** "Rodada 3 de 17 · lance 4 de 9", para a barra e para o leitor de tela. */
export function descreverPosicao(
  { rodada, lance }: PosicaoNoReplay,
  lancesNaRodada: number,
  totalDeRodadas: number,
): string {
  const rodadaTexto = `Rodada ${rodada} de ${totalDeRodadas}`;
  if (lancesNaRodada === 0) return rodadaTexto;
  return `${rodadaTexto} · lance ${lance + 1} de ${lancesNaRodada}`;
}

/** Fração já vista da partida inteira (0 a 1), contando rodadas inteiras e o lance na atual. */
export function progressoDoReplay(
  { rodada, lance }: PosicaoNoReplay,
  lancesNaRodada: number,
  totalDeRodadas: number,
): number {
  if (totalDeRodadas <= 0) return 0;
  const naRodada = lancesNaRodada <= 1 ? 1 : lance / (lancesNaRodada - 1);
  return Math.min(1, (rodada - 1 + naRodada) / totalDeRodadas);
}
