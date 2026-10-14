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

/**
 * Prepara a mesa para exibição: marca quais cartas empataram com outra (não valem mais) e ordena
 * da mais forte para a mais fraca — a mais forte fica à frente da fila na mesa. Empates de força
 * mantêm a ordem em que foram jogadas.
 */
export function organizarMesa(
  jogadas: readonly Jogada[],
  manilha: Valor,
  valores: readonly Valor[],
): JogadaNaMesa[] {
  const quantidade = contarPorForca(jogadas, manilha, valores);
  const forca = (jogada: Jogada) => forcaDaCarta(jogada.carta, manilha, valores);
  return [...jogadas]
    .sort((a, b) => forca(b) - forca(a))
    .map((jogada) => ({ ...jogada, anulada: (quantidade.get(forca(jogada)) ?? 0) > 1 }));
}
