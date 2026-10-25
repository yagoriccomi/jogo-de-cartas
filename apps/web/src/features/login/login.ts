import { useSyncExternalStore } from 'react';
import {
  ENDERECOS_DO_LOGIN,
  ROTAS_DO_LOGIN,
  type ContaVisivel,
  type EstadoDoLogin,
  type PedidoDeTrocaDoLogin,
  type SessaoDeLoginVisivel,
} from '@fodinha/shared';
import { descreverErro, registrar } from '../../lib/log';
import { reconectarComOLoginAtual, socket, URL_SERVIDOR } from '../../lib/socket';
import { esquecerTokenDeLogin, lerTokenDeLogin, salvarTokenDeLogin } from '../../lib/tokenDeLogin';
import { lerRetornoDoLogin } from './retorno';

/**
 * `indisponivel`: o servidor não tem as variáveis do Google (ou não respondeu): o botão some e
 * todos jogam como convidado, que é sempre o padrão.
 */
export type SituacaoDoLogin =
  | { readonly fase: 'verificando' }
  | { readonly fase: 'indisponivel' }
  | { readonly fase: 'convidado' }
  | { readonly fase: 'logado'; readonly conta: ContaVisivel };

export interface EstadoDoLoginNaTela {
  readonly situacao: SituacaoDoLogin;
  /** Aviso curto de uma volta do Google que não deu certo. */
  readonly aviso: string | null;
}

const AVISO_DE_FALHA = 'Não deu para entrar com o Google. Tente de novo ou jogue como convidado.';

let estado: EstadoDoLoginNaTela = { situacao: { fase: 'verificando' }, aviso: null };
const ouvintes = new Set<() => void>();

function atualizar(parcial: Partial<EstadoDoLoginNaTela>): void {
  estado = { ...estado, ...parcial };
  ouvintes.forEach((ouvinte) => ouvinte());
}

export function useLogin(): EstadoDoLoginNaTela {
  return useSyncExternalStore(
    (ouvinte) => {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    () => estado,
  );
}

function cabecalhos(): HeadersInit {
  const token = lerTokenDeLogin();
  return token === null ? {} : { authorization: `Bearer ${token}` };
}

async function consultarEstado(): Promise<void> {
  try {
    const resposta = await fetch(`${URL_SERVIDOR}${ROTAS_DO_LOGIN.estado}`, {
      headers: cabecalhos(),
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const dados = (await resposta.json()) as EstadoDoLogin;
    if (!dados.disponivel) {
      atualizar({ situacao: { fase: 'indisponivel' } });
      return;
    }
    // Token que o servidor não reconhece mais (expirou, saiu em outra aba): esquece aqui também.
    if (dados.conta === null && lerTokenDeLogin() !== null) esquecerTokenDeLogin();
    atualizar({
      situacao: dados.conta ? { fase: 'logado', conta: dados.conta } : { fase: 'convidado' },
    });
  } catch (erro) {
    registrar('warn', 'login.estado_falhou', descreverErro(erro));
    atualizar({ situacao: { fase: 'indisponivel' } });
  }
}

async function trocarCodigo(codigo: string): Promise<boolean> {
  const pedido: PedidoDeTrocaDoLogin = { codigo };
  try {
    const resposta = await fetch(`${URL_SERVIDOR}${ROTAS_DO_LOGIN.trocar}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(pedido),
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const sessao = (await resposta.json()) as SessaoDeLoginVisivel;
    salvarTokenDeLogin(sessao.token);
    return true;
  } catch (erro) {
    registrar('warn', 'login.troca_falhou', descreverErro(erro));
    return false;
  }
}

function limparRetornoDaUrl(): void {
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

/**
 * Chamar uma vez, na abertura: conclui a volta do Google (se for o caso) e descobre se o login
 * existe neste servidor. Quem não loga não espera nada disso para jogar.
 */
export async function iniciarLogin(): Promise<void> {
  const retorno = lerRetornoDoLogin(window.location.hash);
  if (retorno) limparRetornoDaUrl();
  if (retorno?.tipo === 'falha') atualizar({ aviso: AVISO_DE_FALHA });
  if (retorno?.tipo === 'codigo') {
    const entrou = await trocarCodigo(retorno.codigo);
    if (entrou) reconectarComOLoginAtual();
    else atualizar({ aviso: AVISO_DE_FALHA });
  }
  await consultarEstado();
  // Servidor dormindo na abertura: quando ele acordar, a consulta é refeita.
  socket.on('connect', () => {
    if (estado.situacao.fase === 'indisponivel') void consultarEstado();
  });
}

/** Navegação de página inteira: o Google exige sair do site e voltar. */
export function entrarComGoogle(): void {
  const destino = new URL(ROTAS_DO_LOGIN.entrarComGoogle, URL_SERVIDOR);
  destino.searchParams.set(ENDERECOS_DO_LOGIN.origem, window.location.origin);
  window.location.assign(destino.toString());
}

export async function sairDaConta(): Promise<void> {
  const autorizacao = cabecalhos();
  esquecerTokenDeLogin();
  atualizar({ situacao: { fase: 'convidado' }, aviso: null });
  reconectarComOLoginAtual();
  try {
    await fetch(`${URL_SERVIDOR}${ROTAS_DO_LOGIN.sair}`, { method: 'POST', headers: autorizacao });
  } catch (erro) {
    // O token já foi esquecido aqui; no servidor, a sessão expira sozinha.
    registrar('warn', 'login.saida_falhou', descreverErro(erro));
  }
}

export function dispensarAvisoDoLogin(): void {
  atualizar({ aviso: null });
}
