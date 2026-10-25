/**
 * Login opcional com Google. O convidado (só apelido) continua sendo o padrão: sem as variáveis do
 * Google no servidor, `/auth/estado` responde `disponivel: false` e o botão some da tela.
 *
 * Fluxo (web e servidor em domínios diferentes, sem cookie de terceiros):
 * 1. O web navega para `entrarComGoogle?origem=<origem do web>` no servidor.
 * 2. O servidor manda ao Google e, na volta, ao web com `#login=<código de uso único>`.
 * 3. O web troca o código por um token (`trocar`) e o guarda; manda-o no cabeçalho
 *    `Authorization: Bearer` e no aperto de mão do socket (`AutenticacaoDoSocket`).
 */
export const ROTAS_DO_LOGIN = {
  estado: '/auth/estado',
  entrarComGoogle: '/auth/google',
  trocar: '/auth/trocar',
  sair: '/auth/sair',
} as const;

/** Parâmetro da ida (`?origem=`) e chaves do fragmento da volta (`#login=` ou `#login-falhou`). */
export const ENDERECOS_DO_LOGIN = {
  origem: 'origem',
  codigo: 'login',
  falha: 'login-falhou',
} as const;

/** O que a tela mostra de quem está logado. O id da conta nunca vai ao cliente. */
export interface ContaVisivel {
  readonly nome: string;
  readonly email: string;
}

export type EstadoDoLogin =
  | { readonly disponivel: false }
  | { readonly disponivel: true; readonly conta: ContaVisivel | null };

export interface PedidoDeTrocaDoLogin {
  readonly codigo: string;
}

export interface SessaoDeLoginVisivel {
  readonly token: string;
  readonly conta: ContaVisivel;
}

/**
 * `auth` do aperto de mão do Socket.IO. O servidor valida o token e liga o assento à conta; o
 * cliente nunca informa a conta diretamente.
 */
export interface AutenticacaoDoSocket {
  readonly tokenDeLogin?: string;
}
