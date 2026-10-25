import type { Carta, ConfiguracaoPartida } from '@fodinha/shared';
import type { Client } from '@libsql/client';
import { validarConfiguracao } from '../../domain/configuracao';
import { VERSAO_DO_DIARIO, type AutorDaDecisao, type RodadaDoDiario } from '../../domain/diario';
import type { ResultadoDaRodada } from '../../domain/partida';
import type { VisaoDaPartida } from '../../domain/projecao';
import {
  HERANCA_DA_PRIMEIRA_RODADA,
  reconstruirRodada,
  type DecisaoReconstruida,
  type HerancaDaRodada,
} from '../../domain/reconstrucao';

/**
 * Uma linha do JSONL de treino: uma decisão, o que o jogador via, quem decidiu e como a rodada
 * terminou para ele. Sem apelido e sem conta: só ids opacos.
 */
export interface LinhaDeTreino {
  readonly partida: string;
  readonly rodada: number;
  readonly cega: boolean;
  /** Posição da decisão dentro da rodada (palpites primeiro, depois as cartas). */
  readonly ordem: number;
  readonly jogadorId: string;
  readonly autor: AutorDaDecisao;
  readonly visao: VisaoDaPartida;
  readonly decisao:
    | { readonly tipo: 'palpite'; readonly quantidade: number }
    | {
        readonly tipo: 'carta';
        readonly carta: Carta;
        readonly vaza: number;
        readonly venceuAVaza: boolean;
      };
  readonly desfecho: Omit<ResultadoDaRodada, 'jogadorId'> | null;
}

export interface ResumoDoExport {
  readonly linhas: number;
  /**
   * Rodadas de outra versão do diário, corrompidas ou que não fecham com as regras: ficam de fora,
   * contadas. Sem uma rodada, as seguintes da mesma partida também ficam (a visão depende dela).
   */
  readonly rodadasIgnoradas: number;
}

// Lido em páginas para o export não carregar o banco inteiro na memória.
const RODADAS_POR_PAGINA = 200;

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

/** O banco é nosso, mas o JSON atravessa versões: confere o formato antes de usar. */
export function ehRodadaDoDiario(valor: unknown): valor is RodadaDoDiario {
  return (
    ehObjeto(valor) &&
    valor.versao === VERSAO_DO_DIARIO &&
    typeof valor.numero === 'number' &&
    typeof valor.cega === 'boolean' &&
    typeof valor.mortosVeemCartas === 'boolean' &&
    Array.isArray(valor.jogadores) &&
    Array.isArray(valor.palpites) &&
    Array.isArray(valor.vazas) &&
    Array.isArray(valor.ocorrencias) &&
    Array.isArray(valor.resultado)
  );
}

export function lerJson(texto: unknown): unknown {
  if (typeof texto !== 'string') return null;
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return null;
  }
}

/** As decisões reconstruídas de uma rodada, no formato do JSONL. */
export function linhasDaRodada(
  partida: string,
  rodada: RodadaDoDiario,
  decisoes: readonly DecisaoReconstruida[],
): LinhaDeTreino[] {
  const desfechos = new Map(
    rodada.resultado.map(({ jogadorId, ...desfecho }) => [jogadorId, desfecho]),
  );
  return decisoes.map(({ ordem, jogadorId, autor, visao, acao }) => ({
    partida,
    rodada: rodada.numero,
    cega: rodada.cega,
    ordem,
    jogadorId,
    autor,
    visao,
    decisao:
      acao.tipo === 'palpite'
        ? acao
        : {
            ...acao,
            venceuAVaza: rodada.vazas[acao.vaza - 1]?.vencedorId === jogadorId,
          },
    desfecho: desfechos.get(jogadorId) ?? null,
  }));
}

/** A partida cuja sequência de rodadas está sendo lida; `heranca` nula = sequência quebrada. */
interface PartidaEmLeitura {
  readonly id: string;
  readonly configuracao: ConfiguracaoPartida | null;
  proximaRodada: number;
  heranca: HerancaDaRodada | null;
}

function abrirPartida(id: string, configuracao: unknown): PartidaEmLeitura {
  try {
    const valida = validarConfiguracao(lerJson(configuracao));
    return { id, configuracao: valida, proximaRodada: 1, heranca: HERANCA_DA_PRIMEIRA_RODADA };
  } catch {
    return { id, configuracao: null, proximaRodada: 1, heranca: null };
  }
}

/** As decisões da rodada, ou `null` se ela não pode ser reconstruída (e a sequência quebra). */
function decisoesDa(em: PartidaEmLeitura, numero: number, dados: unknown) {
  const rodada = lerJson(dados);
  const continua = em.heranca && em.configuracao && numero === em.proximaRodada;
  em.proximaRodada = numero + 1;
  if (!continua || !ehRodadaDoDiario(rodada) || rodada.numero !== numero) {
    em.heranca = null;
    return null;
  }
  try {
    const reconstruida = reconstruirRodada(
      em.configuracao as ConfiguracaoPartida,
      rodada,
      em.heranca as HerancaDaRodada,
    );
    em.heranca = reconstruida.heranca;
    return linhasDaRodada(em.id, rodada, reconstruida.decisoes);
  } catch {
    em.heranca = null;
    return null;
  }
}

/** Percorre todas as rodadas gravadas e escreve uma linha JSON por decisão. Só lê o banco. */
export async function exportarParaTreino(
  cliente: Client,
  escrever: (linha: string) => void | Promise<void>,
): Promise<ResumoDoExport> {
  let linhas = 0;
  let rodadasIgnoradas = 0;
  let cursor: { partida: string; numero: number } = { partida: '', numero: 0 };
  let emLeitura: PartidaEmLeitura | null = null;
  for (;;) {
    // Em ordem de partida e rodada: cada rodada precisa do que a anterior deixou à vista.
    const pagina = await cliente.execute({
      sql: `SELECT r.partida_id, r.numero, r.dados, p.configuracao
            FROM rodadas r JOIN partidas p ON p.id = r.partida_id
            WHERE r.partida_id > ? OR (r.partida_id = ? AND r.numero > ?)
            ORDER BY r.partida_id, r.numero LIMIT ?`,
      args: [cursor.partida, cursor.partida, cursor.numero, RODADAS_POR_PAGINA],
    });
    for (const linha of pagina.rows) {
      const partida = String(linha.partida_id);
      const numero = Number(linha.numero);
      cursor = { partida, numero };
      if (emLeitura?.id !== partida) emLeitura = abrirPartida(partida, linha.configuracao);
      const decisoes = decisoesDa(emLeitura, numero, linha.dados);
      if (!decisoes) {
        rodadasIgnoradas += 1;
        continue;
      }
      for (const decisao of decisoes) {
        await escrever(JSON.stringify(decisao));
        linhas += 1;
      }
    }
    if (pagina.rows.length < RODADAS_POR_PAGINA) return { linhas, rodadasIgnoradas };
  }
}
