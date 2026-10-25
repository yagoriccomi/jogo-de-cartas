const NIVEIS_DE_LOG = ['debug', 'info', 'warn', 'error'] as const;
type NivelDeLog = (typeof NIVEIS_DE_LOG)[number];

/** Banco do histórico (Turso em produção, `file:` local em desenvolvimento). */
export interface BancoDoHistorico {
  readonly url: string;
  /** Turso exige; o arquivo local não. */
  readonly tokenDeAcesso: string | null;
}

/** Login com Google (Better Auth). Só existe com as quatro variáveis preenchidas. */
export interface ConfiguracaoDoLogin {
  readonly googleClientId: string;
  readonly googleClientSecret: string;
  /** Assina cookies e tokens de sessão: trocar invalida todas as sessões abertas. */
  readonly segredo: string;
  /** Endereço público do servidor (sem barra no fim): base da URL de retorno do Google. */
  readonly urlPublica: string;
}

export interface Ambiente {
  readonly host: string;
  readonly porta: number;
  readonly origensPermitidas: readonly string[];
  readonly nivelDeLog: NivelDeLog;
  readonly atrasoDoBotMs: number;
  /** Só para desenvolvimento: libera o evento `dev:cenario`. Nunca ligar em produção. */
  readonly cenariosDeTeste: boolean;
  /** `null` = sem `TURSO_DATABASE_URL`: nada é gravado e o jogo roda igual. */
  readonly historico: BancoDoHistorico | null;
  /** `null` = sem as variáveis do Google: o login some da tela e todos jogam como convidado. */
  readonly login: ConfiguracaoDoLogin | null;
}

const ESQUEMAS_DO_BANCO = ['libsql:', 'https:', 'http:', 'wss:', 'ws:', 'file:'];

/** Vazio conta como ausente: o `.env.example` traz as chaves sem valor. */
export function lerBancoDoHistorico(
  variaveis: NodeJS.ProcessEnv = process.env,
  urlInformada?: string,
): BancoDoHistorico | null {
  const url = (urlInformada ?? variaveis.TURSO_DATABASE_URL ?? '').trim();
  if (url === '') return null;
  if (!ESQUEMAS_DO_BANCO.some((esquema) => url.startsWith(esquema))) {
    throw new Error(
      `TURSO_DATABASE_URL inválida: use libsql://, https:// ou file: (recebido "${url.split(':')[0]}:").`,
    );
  }
  const token = (variaveis.TURSO_AUTH_TOKEN ?? '').trim();
  return { url, tokenDeAcesso: token === '' ? null : token };
}

const VARIAVEIS_DO_LOGIN = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
] as const;
// O Better Auth recusa segredos curtos em produção; o mesmo piso vale aqui para todos os ambientes.
const TAMANHO_MINIMO_DO_SEGREDO = 32;

/**
 * Tudo vazio: login desligado. Metade preenchida é engano de configuração e derruba o boot, para
 * não subir um login que falha só quando alguém toca no botão.
 */
export function lerConfiguracaoDoLogin(
  variaveis: NodeJS.ProcessEnv = process.env,
): ConfiguracaoDoLogin | null {
  const valores = VARIAVEIS_DO_LOGIN.map((nome) => (variaveis[nome] ?? '').trim());
  const faltando = VARIAVEIS_DO_LOGIN.filter((_, i) => valores[i] === '');
  if (faltando.length === VARIAVEIS_DO_LOGIN.length) return null;
  if (faltando.length > 0) {
    throw new Error(`Login com Google pela metade: faltam ${faltando.join(', ')}.`);
  }
  const [googleClientId = '', googleClientSecret = '', segredo = '', url = ''] = valores;
  if (segredo.length < TAMANHO_MINIMO_DO_SEGREDO) {
    throw new Error(
      `BETTER_AUTH_SECRET curto demais: use ao menos ${TAMANHO_MINIMO_DO_SEGREDO} caracteres.`,
    );
  }
  if (!URL.canParse(url) || !/^https?:$/.test(new URL(url).protocol)) {
    throw new Error('BETTER_AUTH_URL inválida: use o endereço público do servidor (https://...).');
  }
  return { googleClientId, googleClientSecret, segredo, urlPublica: new URL(url).origin };
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
    historico: lerBancoDoHistorico(variaveis),
    login: lerConfiguracaoDoLogin(variaveis),
  };
}
