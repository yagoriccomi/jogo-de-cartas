import { NAIPES, VALORES, type Valor } from './cartas';
import type { ConfiguracaoPartida } from './configuracao';

const VALORES_OPCIONAIS: readonly Valor[] = ['8', '9', '10'];

/** Valores em jogo, do mais fraco ao mais forte (ordem do truco). */
export function valoresEmJogo(incluirOitoNoveDez: boolean): readonly Valor[] {
  if (incluirOitoNoveDez) return VALORES;
  return VALORES.filter((valor) => !VALORES_OPCIONAIS.includes(valor));
}

export function totalDeCartas(configuracao: ConfiguracaoPartida): number {
  return (
    valoresEmJogo(configuracao.incluirOitoNoveDez).length *
    NAIPES.length *
    configuracao.quantidadeBaralhos
  );
}

/** Uma carta do monte é reservada para a vira. */
export function maxCartasPorJogador(totalCartas: number, jogadoresVivos: number): number {
  return Math.floor((totalCartas - 1) / jogadoresVivos);
}
