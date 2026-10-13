/** Retorna um número em [0, 1). Injetado para que embaralhamentos sejam reproduzíveis nos testes. */
export type GeradorAleatorio = () => number;

export function embaralhar<T>(itens: readonly T[], gerar: GeradorAleatorio): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(gerar() * (i + 1));
    [copia[i], copia[j]] = [copia[j] as T, copia[i] as T];
  }
  return copia;
}
