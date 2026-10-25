import type { Client } from '@libsql/client';
import type { FastifyInstance } from 'fastify';
import type { Login, Registrador } from '../../application/portas';
import type { ConfiguracaoDoLogin } from '../ambiente';
import { criarBetterAuth } from './better-auth';
import { LoginBetterAuth } from './login-better-auth';
import { LoginNulo } from './login-nulo';
import { registrarRotasDoLogin } from './rotas-do-login';

export interface LoginAberto {
  readonly login: Login;
  /** Monta as rotas do login no Fastify (com o login desligado, só a que avisa a tela). */
  registrarRotas(http: FastifyInstance): void;
}

export interface PedidoDeLogin {
  readonly configuracao: ConfiguracaoDoLogin | null;
  /** O mesmo cliente do histórico (as migrations já criaram as tabelas); `null` = sem banco. */
  readonly banco: Client | null;
  readonly origensDoWeb: readonly string[];
  readonly registrador: Registrador;
}

/** Sem as variáveis do Google ou sem banco, o login nulo: o jogo segue só com convidados. */
export function abrirLogin({
  configuracao,
  banco,
  origensDoWeb,
  registrador,
}: PedidoDeLogin): LoginAberto {
  if (!configuracao || !banco) {
    const motivo = configuracao ? 'sem banco do histórico' : 'sem GOOGLE_CLIENT_ID';
    registrador.info({}, `Login com Google desligado (${motivo})`);
    const login = new LoginNulo();
    return { login, registrarRotas: (http) => registrarRotasDoLogin(http, login, registrador) };
  }
  const auth = criarBetterAuth(configuracao, banco, origensDoWeb);
  const login = new LoginBetterAuth(auth, configuracao.urlPublica, origensDoWeb);
  registrador.info({}, 'Login com Google ligado');
  return {
    login,
    registrarRotas: (http) => {
      registrarRotasDoLogin(http, login, registrador);
      login.registrarRotas(http, registrador);
    },
  };
}
