import { readdir, readFile } from 'node:fs/promises';
import type { Client } from '@libsql/client';

export interface Migracao {
  /** Nome do arquivo sem extensão (`0001_historico_de_partidas`): a ordem é a do número. */
  readonly versao: string;
  readonly sql: string;
}

const ARQUIVO_DE_MIGRACAO = /^(\d{4}_[a-z0-9_]+)\.sql$/;

const TABELA_DE_CONTROLE = `CREATE TABLE IF NOT EXISTS migracoes_aplicadas (
  versao TEXT PRIMARY KEY,
  aplicada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

/** Lê `apps/server/migrations/` em ordem. Arquivo fora do padrão é ignorado (ex.: um README). */
export async function lerMigracoes(pasta: URL): Promise<Migracao[]> {
  const arquivos = (await readdir(pasta)).filter((nome) => ARQUIVO_DE_MIGRACAO.test(nome)).sort();
  return Promise.all(
    arquivos.map(async (nome) => ({
      versao: nome.replace(/\.sql$/, ''),
      sql: await readFile(new URL(nome, pasta), 'utf8'),
    })),
  );
}

/**
 * Comandos de um arquivo SQL. Simples de propósito: as migrations não usam gatilhos nem `;` ou
 * `--` dentro de textos, então basta tirar os comentários e cortar no ponto e vírgula.
 */
export function comandosDe(sql: string): string[] {
  return sql
    .split('\n')
    .map((linha) => linha.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((comando) => comando.trim())
    .filter((comando) => comando !== '');
}

/**
 * Aplica, em ordem, as migrations que o banco ainda não tem. Idempotente: rodar de novo não faz
 * nada. Cada migration vai num `batch` (uma transação) junto com o registro dela na tabela de
 * controle, então uma falha no meio não deixa o banco pela metade.
 */
export async function aplicarMigracoes(
  cliente: Client,
  migracoes: readonly Migracao[],
): Promise<string[]> {
  await cliente.execute(TABELA_DE_CONTROLE);
  const resultado = await cliente.execute('SELECT versao FROM migracoes_aplicadas');
  const aplicadas = new Set(resultado.rows.map((linha) => String(linha.versao)));
  const pendentes = migracoes.filter((migracao) => !aplicadas.has(migracao.versao));
  for (const migracao of pendentes) {
    await cliente.batch(
      [
        ...comandosDe(migracao.sql),
        { sql: 'INSERT INTO migracoes_aplicadas (versao) VALUES (?)', args: [migracao.versao] },
      ],
      'write',
    );
  }
  return pendentes.map((migracao) => migracao.versao);
}
