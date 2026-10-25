import {
  LIMITES,
  PARAMETROS_DO_HISTORICO,
  ROTAS_DO_HISTORICO,
  type ErroDoHistorico,
  type MotivoDoErroDoHistorico,
  type PaginaDoHistorico,
  type RodadaDoReplay,
} from '@fodinha/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { HistoricoDaConta, Resultado } from '../../application/historico-da-conta';
import type { ContaDeLogin, CursorDoHistorico, Login, Registrador } from '../../application/portas';
import { textoLimitado, tokenDoCabecalho } from '../login/cabecalhos';
import { contaOuConvidado } from '../login/conta-ou-convidado';

const HTTP_PEDIDO_INVALIDO = 400;
const HTTP_SEM_LOGIN = 401;
const HTTP_NAO_ENCONTRADO = 404;
const HTTP_CONFLITO = 409;
const HTTP_ERRO_INTERNO = 500;
const HTTP_INDISPONIVEL = 503;

const RESPOSTAS: Readonly<Record<MotivoDoErroDoHistorico, { status: number; erro: string }>> = {
  sem_login: { status: HTTP_SEM_LOGIN, erro: 'Entre com o Google para ver suas partidas.' },
  desligado: { status: HTTP_INDISPONIVEL, erro: 'O histórico está desligado neste servidor.' },
  nao_encontrada: { status: HTTP_NAO_ENCONTRADO, erro: 'Partida não encontrada.' },
  inacabada: { status: HTTP_CONFLITO, erro: 'Só partidas terminadas têm replay.' },
  invalido: { status: HTTP_PEDIDO_INVALIDO, erro: 'Pedido inválido.' },
  ilegivel: { status: HTTP_ERRO_INTERNO, erro: 'Não deu para montar o replay desta partida.' },
  indisponivel: {
    status: HTTP_INDISPONIVEL,
    erro: 'Histórico indisponível agora. Tente de novo.',
  },
};

/** `<início em ms>.<id da partida>`: opaco para o web, que só o devolve na próxima página. */
const FORMATO_DO_CURSOR = /^(\d{1,16})\.(.+)$/;
const MAXIMO_DE_DIGITOS_DA_RODADA = 6;

export function codificarCursor(cursor: CursorDoHistorico | null): string | null {
  return cursor === null ? null : `${cursor.iniciadaEm}.${cursor.idPartida}`;
}

/** `undefined` = sem cursor (primeira página); `null` = cursor malformado. */
export function decodificarCursor(valor: unknown): CursorDoHistorico | null | undefined {
  if (valor === undefined) return undefined;
  const texto = textoLimitado(valor, LIMITES.maxIdentificador * 2);
  const partes = texto === null ? null : FORMATO_DO_CURSOR.exec(texto);
  if (!partes?.[1] || !partes[2] || partes[2].length > LIMITES.maxIdentificador) return null;
  return { iniciadaEm: Number(partes[1]), idPartida: partes[2] };
}

/** Sem `limite`, o teto; fora de 1..teto, `null`. */
export function lerLimite(valor: unknown): number | null {
  if (valor === undefined) return LIMITES.maxPartidasPorPagina;
  const numero = typeof valor === 'string' && /^\d{1,3}$/.test(valor) ? Number(valor) : NaN;
  return numero >= 1 && numero <= LIMITES.maxPartidasPorPagina ? numero : null;
}

function inteiroPositivo(valor: unknown): number | null {
  if (typeof valor !== 'string' || valor.length > MAXIMO_DE_DIGITOS_DA_RODADA) return null;
  return /^[1-9]\d*$/.test(valor) ? Number(valor) : null;
}

function campo(objeto: unknown, nome: string): unknown {
  return typeof objeto === 'object' && objeto !== null
    ? (objeto as Record<string, unknown>)[nome]
    : undefined;
}

function recusar(resposta: FastifyReply, motivo: MotivoDoErroDoHistorico): FastifyReply {
  const { status, erro } = RESPOSTAS[motivo];
  const corpo: ErroDoHistorico = { motivo, erro };
  return resposta.status(status).send(corpo);
}

export interface DependenciasDasRotas {
  readonly historico: HistoricoDaConta;
  readonly login: Pick<Login, 'ligado' | 'contaDoToken'>;
  readonly registrador: Registrador;
}

/**
 * "Minhas partidas" e o replay por HTTP (CORS de `CORS_ORIGINS`). A conta vem do token do login,
 * nunca de um parâmetro: ninguém pede a partida "da conta X".
 */
export function registrarRotasDoHistorico(
  http: FastifyInstance,
  { historico, login, registrador }: DependenciasDasRotas,
): void {
  async function contaDoPedido(pedido: FastifyRequest): Promise<ContaDeLogin | null> {
    const token = tokenDoCabecalho(pedido.headers.authorization);
    if (!login.ligado || token === null) return null;
    return contaOuConvidado(login, token, registrador);
  }

  /** Banco que cai no meio do pedido vira 503 limpo; o detalhe fica só no log. */
  async function responder<T, R>(
    resposta: FastifyReply,
    consultar: () => Promise<Resultado<T>>,
    converter: (dados: T) => R,
  ): Promise<FastifyReply | R> {
    try {
      const resultado = await consultar();
      return resultado.ok ? converter(resultado.dados) : recusar(resposta, resultado.motivo);
    } catch (erro) {
      registrador.error({ erro }, 'Falha ao ler o histórico');
      return recusar(resposta, 'indisponivel');
    }
  }

  http.get(ROTAS_DO_HISTORICO.partidas, async (pedido, resposta) => {
    if (!historico.ligado) return recusar(resposta, 'desligado');
    const conta = await contaDoPedido(pedido);
    if (!conta) return recusar(resposta, 'sem_login');
    const cursor = decodificarCursor(campo(pedido.query, PARAMETROS_DO_HISTORICO.cursor));
    const limite = lerLimite(campo(pedido.query, PARAMETROS_DO_HISTORICO.limite));
    if (cursor === null || limite === null) return recusar(resposta, 'invalido');
    return responder(
      resposta,
      () => historico.pagina({ conta, depoisDe: cursor ?? null, limite }),
      ({ partidas, proximo }): PaginaDoHistorico => ({
        partidas,
        proximoCursor: codificarCursor(proximo),
      }),
    );
  });

  http.get(ROTAS_DO_HISTORICO.rodadaDoReplay, async (pedido, resposta) => {
    if (!historico.ligado) return recusar(resposta, 'desligado');
    const conta = await contaDoPedido(pedido);
    if (!conta) return recusar(resposta, 'sem_login');
    const idPartida = textoLimitado(campo(pedido.params, 'idPartida'), LIMITES.maxIdentificador);
    const numero = inteiroPositivo(campo(pedido.params, 'numero'));
    if (idPartida === null || numero === null) return recusar(resposta, 'invalido');
    return responder(
      resposta,
      () => historico.rodada({ conta, idPartida, numero }),
      (dados): RodadaDoReplay => ({ idPartida, numeroRodada: numero, ...dados }),
    );
  });
}
