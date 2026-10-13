import type { Jogada, Valor } from '@fodinha/shared';
import { forcaDaCarta } from './forca';

/**
 * Cartas de mesma força se anulam. Vence a carta mais forte que não tenha empate;
 * se todas se anularem, a vaza fica sem dono (`null`).
 */
export function resolverVaza(
  jogadas: readonly Jogada[],
  manilha: Valor,
  valores: readonly Valor[],
): string | null {
  const jogadoresPorForca = new Map<number, string[]>();
  for (const { jogadorId, carta } of jogadas) {
    const forca = forcaDaCarta(carta, manilha, valores);
    jogadoresPorForca.set(forca, [...(jogadoresPorForca.get(forca) ?? []), jogadorId]);
  }

  const forcasDecrescentes = [...jogadoresPorForca.keys()].sort((a, b) => b - a);
  for (const forca of forcasDecrescentes) {
    const jogadores = jogadoresPorForca.get(forca) ?? [];
    if (jogadores.length === 1) return jogadores[0] as string;
  }
  return null;
}
