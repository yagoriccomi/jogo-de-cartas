const NIVEIS_DE_LOG = ['debug', 'info', 'warn', 'error'] as const;
type NivelDeLog = (typeof NIVEIS_DE_LOG)[number];

export interface Ambiente {
  readonly host: string;
  readonly porta: number;
  readonly origensPermitidas: readonly string[];
  readonly nivelDeLog: NivelDeLog;
  readonly atrasoDoBotMs: number;
  /** Só para desenvolvimento: libera o evento `dev:cenario`. Nunca ligar em produção. */
  readonly cenariosDeTeste: boolean;
}

function numeroPositivo(nome: string, valor: string | undefined, padrao: number): number {
  if (valor === undefined || valor === '') return padrao;
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) {
    throw new Error(`Variável de ambiente ${nome} inválida: "${valor}"`);
  }
  return numero;
}

/** Lê e valida a configuração uma única vez, na subida: erro de configuração derruba o boot. */
export function lerAmbiente(variaveis: NodeJS.ProcessEnv = process.env): Ambiente {
  const nivel = (variaveis.LOG_LEVEL ?? 'info') as NivelDeLog;
  if (!NIVEIS_DE_LOG.includes(nivel)) {
    throw new Error(`LOG_LEVEL inválido: "${variaveis.LOG_LEVEL}"`);
  }
  return {
    host: variaveis.HOST || '0.0.0.0',
    porta: numeroPositivo('PORT', variaveis.PORT, 3001),
    origensPermitidas: (variaveis.CORS_ORIGINS ?? 'http://localhost:5173')
      .split(',')
      .map((origem) => origem.trim())
      .filter(Boolean),
    nivelDeLog: nivel,
    // Ritmo de mesa real: dá tempo de os humanos acompanharem cada jogada do bot. Os testes de
    // tela aceleram (não há humano olhando).
    atrasoDoBotMs: numeroPositivo('BOT_DELAY_MS', variaveis.BOT_DELAY_MS, 2000),
    cenariosDeTeste: variaveis.CENARIOS_DE_TESTE === 'true',
  };
}
