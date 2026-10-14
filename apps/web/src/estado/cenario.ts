/** Cenário de teste de desenvolvimento: `?cenario=10x13` = 10 jogadores, 13 cartas na mão. */
export interface CenarioDeTeste {
  readonly jogadores: number;
  readonly cartas: number;
}

const CENARIO_PADRAO: CenarioDeTeste = { jogadores: 10, cartas: 13 };
const FORMATO_DO_CENARIO = /^(\d+)x(\d+)$/;

/**
 * Só existe em `vite dev`: no build de produção o `import.meta.env.DEV` vira `false` e todo o
 * caminho do cenário é descartado. O servidor também recusa o evento sem `CENARIOS_DE_TESTE`.
 */
export function lerCenarioDaUrl(): CenarioDeTeste | null {
  if (!import.meta.env.DEV) return null;
  const parametros = new URLSearchParams(window.location.search);
  if (!parametros.has('cenario')) return null;
  const partes = FORMATO_DO_CENARIO.exec(parametros.get('cenario') ?? '');
  if (!partes) return CENARIO_PADRAO;
  return { jogadores: Number(partes[1]), cartas: Number(partes[2]) };
}
