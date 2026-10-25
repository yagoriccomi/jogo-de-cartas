import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Client } from '@libsql/client';
import {
  CONFIGURACAO_PADRAO,
  ENDERECOS_DO_LOGIN,
  ROTAS_DO_LOGIN,
  type EventosClienteParaServidor,
  type EventosServidorParaCliente,
  type Resposta,
  type SessaoJogador,
} from '@fodinha/shared';
import { getMigrations } from 'better-auth/db/migration';
import Fastify, { type FastifyInstance } from 'fastify';
import { Server } from 'socket.io';
import { io as conectarCliente, type Socket } from 'socket.io-client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CondutorDePartidas } from '../../src/application/condutor-de-partidas';
import { HistoricoDePartidas } from '../../src/application/historico-de-partidas';
import { ServicoDeSalas } from '../../src/application/servico-de-salas';
import { criarEstrategiasDosPerfis } from '../../src/domain/estrategia-bot';
import {
  aleatorioCriptografico,
  IdentificadoresCriptograficos,
  RelogioDoSistema,
  RepositorioDeSalasEmMemoria,
} from '../../src/infrastructure/adaptadores';
import {
  lerAmbiente,
  lerConfiguracaoDoLogin,
  type ConfiguracaoDoLogin,
} from '../../src/infrastructure/ambiente';
import { RegistroDePartidasLibsql } from '../../src/infrastructure/historico/registro-libsql';
import { abrirLogin } from '../../src/infrastructure/login/abrir-login';
import {
  criarBetterAuth,
  opcoesDoBetterAuth,
  type BetterAuth,
} from '../../src/infrastructure/login/better-auth';
import { origemDoWeb, tokenDoCabecalho } from '../../src/infrastructure/login/cabecalhos';
import { LoginBetterAuth } from '../../src/infrastructure/login/login-better-auth';
import { registrarRotasDoLogin } from '../../src/infrastructure/login/rotas-do-login';
import { GatewayDoJogo, type ServidorDoJogo } from '../../src/infrastructure/socket/gateway';
import { BOT_SEM_ERRO, BOTS_CALADOS } from '../apoio';
import { bancoEmMemoria } from './apoio-do-banco';

const silencioso = { info: () => {}, warn: () => {}, error: () => {} };
const WEB = 'http://localhost:5173';
const SERVIDOR = 'http://localhost:3001';
const CONFIGURACAO: ConfiguracaoDoLogin = {
  googleClientId: 'id-de-teste.apps.googleusercontent.com',
  googleClientSecret: 'segredo-do-google-de-teste',
  segredo: 'segredo-de-teste-com-pelo-menos-32-caracteres',
  urlPublica: SERVIDOR,
};
const VARIAVEIS_COMPLETAS = {
  GOOGLE_CLIENT_ID: CONFIGURACAO.googleClientId,
  GOOGLE_CLIENT_SECRET: CONFIGURACAO.googleClientSecret,
  BETTER_AUTH_SECRET: CONFIGURACAO.segredo,
  BETTER_AUTH_URL: `${SERVIDOR}/`,
};

const abertos: { close(): unknown }[] = [];

// O primeiro banco carrega o módulo nativo do libSQL: paga isso fora do tempo de cada teste.
beforeAll(async () => {
  (await bancoEmMemoria()).close();
}, 30_000);

afterEach(async () => {
  for (const aberto of abertos.splice(0).reverse()) await aberto.close();
});

async function banco(): Promise<Client> {
  const cliente = await bancoEmMemoria();
  abertos.push(cliente);
  return cliente;
}

/** Login de verdade (Better Auth + libSQL em memória), sem falar com o Google. */
async function loginLigado() {
  const cliente = await banco();
  const auth = criarBetterAuth(CONFIGURACAO, cliente, [WEB]);
  const login = new LoginBetterAuth(auth, SERVIDOR, [WEB]);
  const http = Fastify();
  abertos.push(http);
  registrarRotasDoLogin(http, login, silencioso);
  login.registrarRotas(http, silencioso);
  return { cliente, auth, login, http };
}

/** O que o callback do Google faria: cria a conta e abre uma sessão. */
async function contaLogada(auth: BetterAuth, nome = 'Ana Souza', email = 'ana@exemplo.com') {
  const contexto = await auth.$context;
  const usuario = await contexto.internalAdapter.createUser(
    { name: nome, email, emailVerified: true },
    { method: 'admin' },
  );
  const sessao = await contexto.internalAdapter.createSession(usuario.id);
  return { contaId: usuario.id, token: sessao.token };
}

const comToken = (token: string) => ({ authorization: `Bearer ${token}` });

describe('Variáveis do login', () => {
  it('sem nenhuma (ou só vazias) o login fica desligado', () => {
    expect(lerAmbiente({}).login).toBeNull();
    expect(lerConfiguracaoDoLogin({ GOOGLE_CLIENT_ID: ' ', BETTER_AUTH_URL: '' })).toBeNull();
  });

  it('com as quatro, liga e guarda só a origem da URL pública', () => {
    expect(lerConfiguracaoDoLogin(VARIAVEIS_COMPLETAS)).toEqual(CONFIGURACAO);
  });

  it('pela metade derruba a subida dizendo o que falta, sem repetir segredo', () => {
    expect(() =>
      lerConfiguracaoDoLogin({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'x' }),
    ).toThrow('faltam BETTER_AUTH_SECRET, BETTER_AUTH_URL');
    expect(() =>
      lerConfiguracaoDoLogin({ ...VARIAVEIS_COMPLETAS, BETTER_AUTH_SECRET: 'curto' }),
    ).toThrow(/^(?!.*curto").*BETTER_AUTH_SECRET curto demais/);
    expect(() =>
      lerConfiguracaoDoLogin({ ...VARIAVEIS_COMPLETAS, BETTER_AUTH_URL: 'ftp://servidor' }),
    ).toThrow('BETTER_AUTH_URL inválida');
  });
});

describe('Bordas do login', () => {
  it('o token só vale no esquema Bearer e dentro do limite', () => {
    expect(tokenDoCabecalho('Bearer abc')).toBe('abc');
    expect(tokenDoCabecalho('bearer abc')).toBe('abc');
    expect(tokenDoCabecalho('Basic abc')).toBeNull();
    expect(tokenDoCabecalho(undefined)).toBeNull();
    expect(tokenDoCabecalho(`Bearer ${'x'.repeat(1000)}`)).toBeNull();
  });

  it('a volta do login só vai a uma origem de CORS_ORIGINS, sem caminho', () => {
    expect(origemDoWeb(WEB, [WEB])).toBe(WEB);
    expect(origemDoWeb(`${WEB}/mesa`, [WEB])).toBeNull();
    expect(origemDoWeb('https://golpe.example', [WEB])).toBeNull();
    expect(origemDoWeb(['x'], [WEB])).toBeNull();
  });
});

describe('Login desligado', () => {
  async function rotasDesligadas(configuracao: ConfiguracaoDoLogin | null, comBanco: boolean) {
    const http = Fastify();
    abertos.push(http);
    const aberto = abrirLogin({
      configuracao,
      banco: comBanco ? await banco() : null,
      origensDoWeb: [WEB],
      registrador: silencioso,
    });
    aberto.registrarRotas(http);
    return { http, login: aberto.login };
  }

  it.each([
    ['sem as variáveis do Google', null, true],
    ['sem banco', CONFIGURACAO, false],
  ] as const)(
    '%s: a tela é avisada e as outras rotas não existem',
    async (_, configuracao, comBanco) => {
      const { http, login } = await rotasDesligadas(configuracao, comBanco);
      expect(login.ligado).toBe(false);
      const estado = await http.inject({ method: 'GET', url: ROTAS_DO_LOGIN.estado });
      expect(estado.json()).toEqual({ disponivel: false });
      const troca = await http.inject({
        method: 'POST',
        url: ROTAS_DO_LOGIN.trocar,
        payload: { codigo: 'qualquer' },
      });
      expect(troca.statusCode).toBe(404);
      const google = await http.inject({
        method: 'GET',
        url: `${ROTAS_DO_LOGIN.entrarComGoogle}?origem=${WEB}`,
      });
      expect(google.statusCode).toBe(404);
      const saida = await http.inject({ method: 'POST', url: ROTAS_DO_LOGIN.sair });
      expect(saida.statusCode).toBe(204);
    },
  );
});

describe('Login com Google (Better Auth, sem chamar o Google)', () => {
  it('a migration 0002 cria exatamente o esquema que o Better Auth espera', async () => {
    const cliente = await banco();
    const plano = await getMigrations(opcoesDoBetterAuth(CONFIGURACAO, cliente, [WEB]));
    expect(plano.toBeCreated).toEqual([]);
    expect(plano.toBeAdded).toEqual([]);
    expect(plano.toBeAddedIndexes).toEqual([]);
  });

  it('a ida ao Google sai do domínio do servidor com o cookie de estado e a volta certa', async () => {
    const { http } = await loginLigado();
    const resposta = await http.inject({
      method: 'GET',
      url: `${ROTAS_DO_LOGIN.entrarComGoogle}?${ENDERECOS_DO_LOGIN.origem}=${encodeURIComponent(WEB)}`,
    });
    expect(resposta.statusCode).toBe(302);
    const destino = new URL(String(resposta.headers.location));
    expect(destino.origin).toBe('https://accounts.google.com');
    expect(destino.searchParams.get('client_id')).toBe(CONFIGURACAO.googleClientId);
    expect(destino.searchParams.get('redirect_uri')).toBe(`${SERVIDOR}/api/auth/callback/google`);
    expect(String(resposta.headers['set-cookie'])).toContain('state');
  });

  it('recusa mandar a volta do login para fora de CORS_ORIGINS', async () => {
    const { http } = await loginLigado();
    const resposta = await http.inject({
      method: 'GET',
      url: `${ROTAS_DO_LOGIN.entrarComGoogle}?origem=${encodeURIComponent('https://golpe.example')}`,
    });
    expect(resposta.statusCode).toBe(400);
  });

  it('do fim do redirecionamento ao web: código de uso único trocado por token', async () => {
    const { http, auth } = await loginLigado();
    const { token } = await contaLogada(auth);

    const conclusao = await http.inject({
      method: 'GET',
      url: `/auth/concluir?origem=${encodeURIComponent(WEB)}`,
      headers: comToken(token),
    });
    expect(conclusao.statusCode).toBe(302);
    const destino = String(conclusao.headers.location);
    expect(destino.startsWith(`${WEB}/#${ENDERECOS_DO_LOGIN.codigo}=`)).toBe(true);
    expect(destino).not.toContain(token);
    const codigo = decodeURIComponent(destino.split('=')[1] ?? '');

    const troca = await http.inject({
      method: 'POST',
      url: ROTAS_DO_LOGIN.trocar,
      payload: { codigo },
    });
    expect(troca.json()).toEqual({
      token,
      conta: { nome: 'Ana Souza', email: 'ana@exemplo.com' },
    });
    const repetida = await http.inject({
      method: 'POST',
      url: ROTAS_DO_LOGIN.trocar,
      payload: { codigo },
    });
    expect(repetida.statusCode).toBe(400);
  });

  it('sem sessão no fim do redirecionamento, o web recebe a falha', async () => {
    const { http } = await loginLigado();
    const resposta = await http.inject({
      method: 'GET',
      url: `/auth/concluir?origem=${encodeURIComponent(WEB)}`,
    });
    expect(resposta.headers.location).toBe(`${WEB}/#${ENDERECOS_DO_LOGIN.falha}`);
  });

  it('estado mostra quem está logado e, depois de sair, ninguém', async () => {
    const { http, auth } = await loginLigado();
    const { token } = await contaLogada(auth);
    const estado = () =>
      http.inject({ method: 'GET', url: ROTAS_DO_LOGIN.estado, headers: comToken(token) });

    expect((await estado()).json()).toEqual({
      disponivel: true,
      conta: { nome: 'Ana Souza', email: 'ana@exemplo.com' },
    });
    const saida = await http.inject({
      method: 'POST',
      url: ROTAS_DO_LOGIN.sair,
      headers: comToken(token),
    });
    expect(saida.statusCode).toBe(204);
    expect((await estado()).json()).toEqual({ disponivel: true, conta: null });
  });

  it('token forjado não vale', async () => {
    const { login } = await loginLigado();
    expect(await login.contaDoToken('token-inventado')).toBeNull();
  });
});

type SocketCliente = Socket<EventosServidorParaCliente, EventosClienteParaServidor>;

describe('Conta ligada ao assento pelo socket', () => {
  async function mesaComHistorico() {
    const { cliente, auth, login, http } = await loginLigado();
    const relogio = new RelogioDoSistema();
    const identificadores = new IdentificadoresCriptograficos();
    const historico = new HistoricoDePartidas({
      registro: new RegistroDePartidasLibsql(cliente),
      identificadores,
      relogio,
      registrador: silencioso,
    });
    const servidorHttp = createServer();
    const io: ServidorDoJogo = new Server(servidorHttp);
    const condutor = new CondutorDePartidas({
      notificador: {
        enviarEstadoSala: () => {},
        enviarEstadoPartida: () => {},
        enviarReacao: () => {},
      },
      relogio,
      estrategias: criarEstrategiasDosPerfis(BOT_SEM_ERRO),
      registrador: silencioso,
      gerarAleatorio: BOTS_CALADOS,
      historico,
      tempos: {
        atrasoDoBotMs: 60_000,
        pausaFimDeRodadaMs: 60_000,
        pausaExtraRodadaCegaMs: 0,
        carenciaDeDesconexaoMs: 60_000,
      },
    });
    const servico = new ServicoDeSalas({
      repositorio: new RepositorioDeSalasEmMemoria(),
      condutor,
      identificadores,
      relogio,
      gerarAleatorio: aleatorioCriptografico,
      registrador: silencioso,
      tempoDeAbandonoMs: 600_000,
    });
    new GatewayDoJogo(io, servico, silencioso, { login }).iniciar();
    await new Promise<void>((resolver) => servidorHttp.listen(0, '127.0.0.1', resolver));
    abertos.push({ close: () => new Promise<void>((resolver) => io.close(() => resolver())) });
    const url = `http://127.0.0.1:${(servidorHttp.address() as AddressInfo).port}`;
    return { cliente, auth, http: http as FastifyInstance, historico, url, servico };
  }

  async function conectar(url: string, tokenDeLogin?: string): Promise<SocketCliente> {
    const socket: SocketCliente = conectarCliente(url, {
      transports: ['websocket'],
      reconnection: false,
      auth: tokenDeLogin === undefined ? {} : { tokenDeLogin },
    });
    abertos.push({ close: () => socket.disconnect() });
    await new Promise<void>((resolver, rejeitar) => {
      socket.once('connect', resolver);
      socket.once('connect_error', rejeitar);
    });
    return socket;
  }

  function emitir<T>(enviar: (responder: (resposta: Resposta<T>) => void) => void): Promise<T> {
    return new Promise((resolver, rejeitar) =>
      enviar((resposta) =>
        resposta.ok ? resolver(resposta.dados) : rejeitar(new Error(resposta.erro.codigo)),
      ),
    );
  }

  async function contasGravadas(cliente: Client): Promise<Map<string, unknown>> {
    const linhas = await cliente.execute(
      'SELECT jogador_id, tipo, conta_id FROM participantes_da_partida',
    );
    return new Map(linhas.rows.map((linha) => [String(linha.jogador_id), linha.conta_id]));
  }

  it('logado grava conta_id; convidado, bot e token forjado ficam nulos', async () => {
    const mesa = await mesaComHistorico();
    const { contaId, token } = await contaLogada(mesa.auth);
    const ana = await conectar(mesa.url, token);
    const bia = await conectar(mesa.url);
    const caio = await conectar(mesa.url, 'token-forjado');

    const sessaoAna = await emitir<SessaoJogador>((r) =>
      ana.emit(
        'sala:criar',
        // Campo a mais no payload é ignorado: a conta só vem do aperto de mão.
        {
          apelido: 'Ana',
          configuracao: CONFIGURACAO_PADRAO,
          dispositivoId: 'd-ana',
          contaId: 'x',
        } as never,
        r,
      ),
    );
    const sessaoBia = await emitir<SessaoJogador>((r) =>
      bia.emit(
        'sala:entrar',
        { codigoSala: sessaoAna.codigoSala, apelido: 'Bia', dispositivoId: 'd-bia' },
        r,
      ),
    );
    const sessaoCaio = await emitir<SessaoJogador>((r) =>
      caio.emit(
        'sala:entrar',
        { codigoSala: sessaoAna.codigoSala, apelido: 'Caio', dispositivoId: 'd-caio' },
        r,
      ),
    );
    await emitir<null>((r) => ana.emit('sala:adicionarBot', r));
    await emitir<null>((r) => ana.emit('sala:iniciarPartida', r));
    await mesa.historico.aguardarGravacoes();

    const contas = await contasGravadas(mesa.cliente);
    expect(contas.size).toBe(4);
    expect(contas.get(sessaoAna.jogadorId)).toBe(contaId);
    expect(contas.get(sessaoBia.jogadorId)).toBeNull();
    expect(contas.get(sessaoCaio.jogadorId)).toBeNull();
    expect([...contas.values()].filter((conta) => conta !== null)).toEqual([contaId]);
  });
});
