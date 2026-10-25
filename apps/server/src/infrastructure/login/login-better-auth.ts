import { ENDERECOS_DO_LOGIN, ROTAS_DO_LOGIN } from '@fodinha/shared';
import { isAPIError } from 'better-auth/api';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ContaDeLogin, Login, Registrador, SessaoDeLogin } from '../../application/portas';
import { CAMINHO_DO_BETTER_AUTH, type BetterAuth } from './better-auth';
import { cabecalhoBearer, cabecalhosDe, origemDoWeb } from './cabecalhos';

/** Fim do redirecionamento, no domínio do servidor: daqui a sessão segue para o web. */
const ROTA_DE_CONCLUSAO = '/auth/concluir';
const PARAMETRO_DE_FALHA = 'falhou';
const HTTP_PEDIDO_INVALIDO = 400;

interface UsuarioDoBetterAuth {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

function conta(usuario: UsuarioDoBetterAuth): ContaDeLogin {
  return { id: usuario.id, nome: usuario.name, email: usuario.email };
}

/** Erro "esperado" do Better Auth (token ruim, sessão encerrada) vira `null`; o resto sobe. */
async function ouNulo<T>(acao: () => Promise<T>): Promise<T | null> {
  try {
    return await acao();
  } catch (erro) {
    if (isAPIError(erro)) return null;
    throw erro;
  }
}

/**
 * Login com Google pelo Better Auth, montado no próprio Fastify, com as sessões no banco do
 * histórico. O web fica em outro domínio (Vercel × Render): em vez de cookie de terceiros (que o
 * Safari bloqueia), o cookie do Better Auth só vive no domínio do servidor durante o
 * redirecionamento, e o web recebe um token por um código de uso único.
 */
export class LoginBetterAuth implements Login {
  readonly ligado = true;

  constructor(
    private readonly auth: BetterAuth,
    private readonly urlPublica: string,
    private readonly origensDoWeb: readonly string[],
  ) {}

  async contaDoToken(token: string): Promise<ContaDeLogin | null> {
    const sessao = await ouNulo(() =>
      this.auth.api.getSession({ headers: cabecalhoBearer(token) }),
    );
    return sessao ? conta(sessao.user) : null;
  }

  async trocarCodigo(codigo: string): Promise<SessaoDeLogin | null> {
    const sessao = await ouNulo(() =>
      this.auth.api.verifyOneTimeToken({ body: { token: codigo } }),
    );
    return sessao ? { token: sessao.session.token, conta: conta(sessao.user) } : null;
  }

  async encerrar(token: string): Promise<void> {
    await ouNulo(() => this.auth.api.signOut({ headers: cabecalhoBearer(token) }));
  }

  /** Rotas de navegação (não `fetch`): a ida ao Google, a volta dele e o fim no domínio do web. */
  registrarRotas(http: FastifyInstance, registrador: Registrador): void {
    http.route({
      method: ['GET', 'POST'],
      url: `${CAMINHO_DO_BETTER_AUTH}/*`,
      handler: (pedido, resposta) => this.repassar(pedido, resposta),
    });
    http.get(ROTAS_DO_LOGIN.entrarComGoogle, (pedido, resposta) =>
      this.irAoGoogle(pedido, resposta),
    );
    http.get(ROTA_DE_CONCLUSAO, async (pedido, resposta) => {
      try {
        return await this.concluir(pedido, resposta);
      } catch (erro) {
        registrador.error({ erro }, 'Falha ao concluir o login com Google');
        return this.voltarComFalha(pedido, resposta);
      }
    });
  }

  /** Entrega ao Better Auth (sobretudo `/api/auth/callback/google`) e devolve a resposta dele. */
  private async repassar(pedido: FastifyRequest, resposta: FastifyReply): Promise<FastifyReply> {
    const corpo =
      pedido.method === 'GET' || pedido.body === undefined
        ? undefined
        : JSON.stringify(pedido.body);
    const respostaDoAuth = await this.auth.handler(
      new Request(new URL(pedido.url, this.urlPublica), {
        method: pedido.method,
        headers: cabecalhosDe(pedido.headers),
        body: corpo,
      }),
    );
    resposta.status(respostaDoAuth.status);
    respostaDoAuth.headers.forEach((valor, nome) => {
      if (nome !== 'set-cookie') resposta.header(nome, valor);
    });
    for (const cookie of respostaDoAuth.headers.getSetCookie())
      resposta.header('set-cookie', cookie);
    return resposta.send(respostaDoAuth.body ? await respostaDoAuth.text() : null);
  }

  /**
   * Navegação de topo no domínio do servidor: o cookie de estado do OAuth é de primeira parte, e
   * a volta do Google (também de topo) o traz junto, em qualquer navegador.
   */
  private async irAoGoogle(pedido: FastifyRequest, resposta: FastifyReply): Promise<FastifyReply> {
    const origem = origemDoWeb(
      this.parametro(pedido, ENDERECOS_DO_LOGIN.origem),
      this.origensDoWeb,
    );
    if (origem === null) {
      return resposta.status(HTTP_PEDIDO_INVALIDO).send({ erro: 'Origem do login não permitida.' });
    }
    const conclusao = this.urlDeConclusao(origem);
    const { headers, response } = await this.auth.api.signInSocial({
      body: {
        provider: 'google',
        callbackURL: conclusao.toString(),
        errorCallbackURL: `${conclusao.toString()}&${PARAMETRO_DE_FALHA}=1`,
        disableRedirect: true,
      },
      returnHeaders: true,
    });
    for (const cookie of headers.getSetCookie()) resposta.header('set-cookie', cookie);
    if (!response.url) throw new Error('O Better Auth não devolveu a URL do Google.');
    return resposta.redirect(response.url);
  }

  private async concluir(pedido: FastifyRequest, resposta: FastifyReply): Promise<FastifyReply> {
    const origem = origemDoWeb(
      this.parametro(pedido, ENDERECOS_DO_LOGIN.origem),
      this.origensDoWeb,
    );
    if (origem === null) {
      return resposta.status(HTTP_PEDIDO_INVALIDO).send({ erro: 'Origem do login não permitida.' });
    }
    if (this.parametro(pedido, PARAMETRO_DE_FALHA) !== undefined) {
      return this.voltarComFalha(pedido, resposta);
    }
    const headers = cabecalhosDe(pedido.headers);
    const sessao = await ouNulo(() => this.auth.api.getSession({ headers }));
    if (!sessao) return this.voltarComFalha(pedido, resposta);
    const { token } = await this.auth.api.generateOneTimeToken({ headers });
    await this.apagarCookieDeSessao(resposta);
    // No fragmento, e não na query: não chega aos logs de quem serve o web.
    return resposta.redirect(
      `${origem}/#${ENDERECOS_DO_LOGIN.codigo}=${encodeURIComponent(token)}`,
    );
  }

  private voltarComFalha(pedido: FastifyRequest, resposta: FastifyReply): FastifyReply {
    const origem = origemDoWeb(
      this.parametro(pedido, ENDERECOS_DO_LOGIN.origem),
      this.origensDoWeb,
    );
    if (origem === null) {
      return resposta.status(HTTP_PEDIDO_INVALIDO).send({ erro: 'Origem do login não permitida.' });
    }
    return resposta.redirect(`${origem}/#${ENDERECOS_DO_LOGIN.falha}`);
  }

  /** A sessão segue no token do web; o cookie do domínio do servidor não serve mais para nada. */
  private async apagarCookieDeSessao(resposta: FastifyReply): Promise<void> {
    const { name, attributes } = (await this.auth.$context).authCookies.sessionToken;
    const seguro = attributes.secure ? '; Secure' : '';
    resposta.header(
      'set-cookie',
      `${name}=; Max-Age=0; Path=${attributes.path ?? '/'}; HttpOnly; SameSite=Lax${seguro}`,
    );
  }

  private urlDeConclusao(origem: string): URL {
    const url = new URL(ROTA_DE_CONCLUSAO, this.urlPublica);
    url.searchParams.set(ENDERECOS_DO_LOGIN.origem, origem);
    return url;
  }

  private parametro(pedido: FastifyRequest, nome: string): unknown {
    const query: unknown = pedido.query;
    return typeof query === 'object' && query !== null
      ? (query as Record<string, unknown>)[nome]
      : undefined;
  }
}
