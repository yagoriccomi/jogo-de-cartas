export const NAIPES = ['ouros', 'espadas', 'copas', 'paus'] as const;
export type Naipe = (typeof NAIPES)[number];

export const VALORES = ['4', '5', '6', '7', '8', '9', '10', 'Q', 'J', 'K', 'A', '2', '3'] as const;
export type Valor = (typeof VALORES)[number];

/**
 * O `id` é opaco e sorteado a cada distribuição: não revela valor nem naipe,
 * para que o cliente possa referenciar uma carta oculta (rodada cega) sem descobri-la.
 */
export interface Carta {
  readonly id: string;
  readonly valor: Valor;
  readonly naipe: Naipe;
}

export interface CartaOculta {
  readonly id: string;
  readonly oculta: true;
}

export type CartaNaMao = Carta | CartaOculta;

export function ehCartaOculta(carta: CartaNaMao): carta is CartaOculta {
  return 'oculta' in carta;
}
