import type { Jogada, JogadaNaMesa, Valor } from '@fodinha/shared';
import { forcaDaCarta } from './forca';

function contarPorForca(
  jogadas: readonly Jogada[],
  manilha: Valor,
  valores: readonly Valor[],
): Map<number, number> {
  const quantidade = new Map<number, number>();
  for (const { carta } of jogadas) {
    const forca = forcaDaCarta(carta, manilha, valores);
    quantidade.set(forca, (quantidade.get(forca) ?? 0) + 1);
  }
  return quantidade;
}

/**
 * Cartas de mesma força se anulam. Vence a carta mais forte que não tenha empate;
 * se todas se anularem, a vaza fica sem dono (`null`).
 */
export function resolverVaza(
  jogadas: readonly Jogada[],
  manilha: Valor,
  valores: readonly Valor[],
): string | null {
  const quantidade = contarPorForca(jogadas, manilha, valores);
  const valendo = jogadas.filter(
    ({ carta }) => quantidade.get(forcaDaCarta(carta, manilha, valores)) === 1,
  );
  const maisForte = valendo.reduce<Jogada | null>(
    (melhor, jogada) =>
      melhor === null ||
      forcaDaCarta(jogada.carta, manilha, valores) > forcaDaCarta(melhor.carta, manilha, valores)
        ? jogada
        : melhor,
    null,
  );
  return maisForte?.jogadorId ?? null;
}

/** Marca, já durante a vaza, quais cartas empataram com outra e por isso não valem mais. */
export function marcarAnuladas(
  jogadas: readonly Jogada[],
  manilha: Valor,
  valores: readonly Valor[],
): JogadaNaMesa[] {
  const quantidade = contarPorForca(jogadas, manilha, valores);
  return jogadas.map((jogada) => ({
    ...jogada,
    anulada: (quantidade.get(forcaDaCarta(jogada.carta, manilha, valores)) ?? 0) > 1,
  }));
}
