import {
  LIMITES,
  ROTAS_DO_LOGIN,
  type ContaVisivel,
  type EstadoDoLogin,
  type SessaoDeLoginVisivel,
} from '@fodinha/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ContaDeLogin, Login, Registrador } from '../../application/portas';
import { textoLimitado, tokenDoCabecalho } from './cabecalhos';
import { contaOuConvidado } from './conta-ou-convidado';

const HTTP_SEM_CONTEUDO = 204;
const HTTP_PEDIDO_INVALIDO = 400;
const HTTP_NAO_ENCONTRADO = 404;
const HTTP_INDISPONIVEL = 503;

/** O id da conta fica no servidor: a tela só precisa saber quem é. */
function contaVisivel(conta: ContaDeLogin): ContaVisivel {
  return { nome: conta.nome, email: conta.email };
}

function recusar(resposta: FastifyReply, status: number, mensagem: string): FastifyReply {
  return resposta.status(status).send({ erro: mensagem });
}

/**
 * Rotas do login que o web chama por `fetch` (CORS de `CORS_ORIGINS`, sem cookie). Valem com o
 * login ligado ou desligado: desligado, `estado` avisa a tela, e o resto responde 404.
 */
export function registrarRotasDoLogin(
  http: FastifyInstance,
  login: Login,
  registrador: Registrador,
): void {
  http.get(ROTAS_DO_LOGIN.estado, async (pedido): Promise<EstadoDoLogin> => {
    if (!login.ligado) return { disponivel: false };
    const token = tokenDoCabecalho(pedido.headers.authorization);
    const conta = token === null ? null : await contaOuConvidado(login, token, registrador);
    return { disponivel: true, conta: conta === null ? null : contaVisivel(conta) };
  });

  http.post(ROTAS_DO_LOGIN.trocar, async (pedido, resposta) => {
    if (!login.ligado) return recusar(resposta, HTTP_NAO_ENCONTRADO, 'Login desligado.');
    const corpo: unknown = pedido.body;
    const codigo = textoLimitado(
      typeof corpo === 'object' && corpo !== null
        ? (corpo as Record<string, unknown>).codigo
        : null,
      LIMITES.maxTokenDeLogin,
    );
    if (codigo === null) return recusar(resposta, HTTP_PEDIDO_INVALIDO, 'Código inválido.');
    try {
      const sessao = await login.trocarCodigo(codigo);
      if (sessao === null) {
        return recusar(resposta, HTTP_PEDIDO_INVALIDO, 'Código expirado. Entre de novo.');
      }
      const visivel: SessaoDeLoginVisivel = {
        token: sessao.token,
        conta: contaVisivel(sessao.conta),
      };
      return visivel;
    } catch (erro) {
      registrador.error({ erro }, 'Falha ao concluir o login');
      return recusar(resposta, HTTP_INDISPONIVEL, 'Login indisponível agora. Tente de novo.');
    }
  });

  http.post(ROTAS_DO_LOGIN.sair, async (pedido, resposta) => {
    const token = tokenDoCabecalho(pedido.headers.authorization);
    if (login.ligado && token !== null) {
      try {
        await login.encerrar(token);
      } catch (erro) {
        // O web esquece o token de qualquer jeito; a sessão expira sozinha no banco.
        registrador.warn({ erro }, 'Falha ao encerrar a sessão de login');
      }
    }
    return resposta.status(HTTP_SEM_CONTEUDO).send();
  });
}
