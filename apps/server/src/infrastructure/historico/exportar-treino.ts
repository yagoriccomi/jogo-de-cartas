import type { Carta } from '@fodinha/shared';
import type { Client } from '@libsql/client';
import {
  VERSAO_DO_DIARIO,
  type AutorDaDecisao,
  type Decisao,
  type RodadaDoDiario,
} from '../../domain/diario';
import type { ResultadoDaRodada } from '../../domain/partida';
import type { VisaoDaPartida } from '../../domain/projecao';

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
  /** Rodadas de outra versão do diário (ou corrompidas): ficam de fora, contadas. */
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
    Array.isArray(valor.palpites) &&
    Array.isArray(valor.vazas) &&
    Array.isArray(valor.resultado)
  );
}

function lerJson(texto: unknown): unknown {
  if (typeof texto !== 'string') return null;
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return null;
  }
}

/** As decisões de uma rodada, na ordem em que aconteceram. Jogada sem decisão (cega) não entra. */
export function linhasDaRodada(partida: string, rodada: RodadaDoDiario): LinhaDeTreino[] {
  const desfechos = new Map(
    rodada.resultado.map(({ jogadorId, ...desfecho }) => [jogadorId, desfecho]),
  );
  const base = (jogadorId: string, decisao: Decisao, ordem: number) => ({
    partida,
    rodada: rodada.numero,
    cega: rodada.cega,
    ordem,
    jogadorId,
    autor: decisao.autor,
    visao: decisao.visao,
    desfecho: desfechos.get(jogadorId) ?? null,
  });
  const linhas: LinhaDeTreino[] = [];
  for (const palpite of rodada.palpites) {
    if (!palpite.decisao) continue;
    linhas.push({
      ...base(palpite.jogadorId, palpite.decisao, linhas.length),
      decisao: { tipo: 'palpite', quantidade: palpite.quantidade },
    });
  }
  rodada.vazas.forEach((vaza, indiceDaVaza) => {
    for (const jogada of vaza.jogadas) {
      if (!jogada.decisao) continue;
      linhas.push({
        ...base(jogada.jogadorId, jogada.decisao, linhas.length),
        decisao: {
          tipo: 'carta',
          carta: jogada.carta,
          vaza: indiceDaVaza + 1,
          venceuAVaza: vaza.vencedorId === jogada.jogadorId,
        },
      });
    }
  });
  return linhas;
}

/** Percorre todas as rodadas gravadas e escreve uma linha JSON por decisão. Só lê o banco. */
export async function exportarParaTreino(
  cliente: Client,
  escrever: (linha: string) => void | Promise<void>,
): Promise<ResumoDoExport> {
  let linhas = 0;
  let rodadasIgnoradas = 0;
  let cursor: { partida: string; numero: number } = { partida: '', numero: 0 };
  for (;;) {
    const pagina = await cliente.execute({
      sql: `SELECT partida_id, numero, dados FROM rodadas
            WHERE partida_id > ? OR (partida_id = ? AND numero > ?)
            ORDER BY partida_id, numero LIMIT ?`,
      args: [cursor.partida, cursor.partida, cursor.numero, RODADAS_POR_PAGINA],
    });
    for (const linha of pagina.rows) {
      const partida = String(linha.partida_id);
      cursor = { partida, numero: Number(linha.numero) };
      const rodada = lerJson(linha.dados);
      if (!ehRodadaDoDiario(rodada)) {
        rodadasIgnoradas += 1;
        continue;
      }
      for (const decisao of linhasDaRodada(partida, rodada)) {
        await escrever(JSON.stringify(decisao));
        linhas += 1;
      }
    }
    if (pagina.rows.length < RODADAS_POR_PAGINA) return { linhas, rodadasIgnoradas };
  }
}
