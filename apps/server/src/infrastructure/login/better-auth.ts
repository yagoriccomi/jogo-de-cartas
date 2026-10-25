import type { Client } from '@libsql/client';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { bearer, oneTimeToken } from 'better-auth/plugins';
import type { ConfiguracaoDoLogin } from '../ambiente';
import { DialetoLibsql } from './dialeto-libsql';

/** Onde o Better Auth atende (`/api/auth/callback/google` é a URL de retorno do Google). */
export const CAMINHO_DO_BETTER_AUTH = '/api/auth';

/**
 * O código que leva a sessão do domínio do servidor para o do web vale só isto: ele viaja no
 * endereço da página, então tem de morrer logo, e é consumido no primeiro uso.
 */
const VALIDADE_DO_CODIGO_DE_LOGIN_MINUTOS = 1;

export function opcoesDoBetterAuth(
  configuracao: ConfiguracaoDoLogin,
  cliente: Client,
  origensDoWeb: readonly string[],
) {
  return {
    appName: 'Fodinha',
    baseURL: configuracao.urlPublica,
    basePath: CAMINHO_DO_BETTER_AUTH,
    secret: configuracao.segredo,
    // Só o web pode receber a volta do login (`callbackURL`); o resto é recusado pelo Better Auth.
    trustedOrigins: [...origensDoWeb],
    database: { dialect: new DialetoLibsql(cliente), type: 'sqlite', transaction: false },
    socialProviders: {
      google: {
        clientId: configuracao.googleClientId,
        clientSecret: configuracao.googleClientSecret,
        // Quem divide o computador escolhe a conta, em vez de entrar direto na última usada.
        prompt: 'select_account',
      },
    },
    // Os tokens do Google não são usados depois do login; ficam cifrados para não vazar num dump.
    account: { encryptOAuthTokens: true },
    telemetry: { enabled: false },
    plugins: [
      // O web (outro domínio) manda a sessão no cabeçalho `Authorization`, não em cookie.
      bearer(),
      oneTimeToken({
        expiresIn: VALIDADE_DO_CODIGO_DE_LOGIN_MINUTOS,
        // Só o próprio servidor gera o código, no fim do redirecionamento (nunca por HTTP).
        disableClientRequest: true,
        disableSetSessionCookie: true,
        storeToken: 'hashed',
      }),
    ],
  } satisfies BetterAuthOptions;
}

export function criarBetterAuth(
  configuracao: ConfiguracaoDoLogin,
  cliente: Client,
  origensDoWeb: readonly string[],
) {
  return betterAuth(opcoesDoBetterAuth(configuracao, cliente, origensDoWeb));
}

export type BetterAuth = ReturnType<typeof criarBetterAuth>;
