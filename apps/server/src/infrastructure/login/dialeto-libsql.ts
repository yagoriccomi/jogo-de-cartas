import type { Client, InValue } from '@libsql/client';
import {
  CompiledQuery,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  type DatabaseConnection,
  type Dialect,
  type Driver,
  type QueryResult,
} from 'kysely';

/**
 * Conexão do Kysely sobre o mesmo cliente libSQL do histórico. O Better Auth fala Kysely; o pacote
 * oficial `@libsql/kysely-libsql` traria uma segunda cópia (antiga) do `@libsql/client`.
 */
class ConexaoLibsql implements DatabaseConnection {
  constructor(private readonly cliente: Client) {}

  async executeQuery<R>(consulta: CompiledQuery): Promise<QueryResult<R>> {
    const resultado = await this.cliente.execute({
      sql: consulta.sql,
      args: consulta.parameters as InValue[],
    });
    // As linhas do libSQL são "array + colunas"; o Kysely espera objetos simples.
    const linhas = resultado.rows.map((linha) =>
      Object.fromEntries(resultado.columns.map((coluna, i) => [coluna, linha[i]])),
    ) as R[];
    return {
      rows: linhas,
      numAffectedRows: BigInt(resultado.rowsAffected),
      insertId:
        resultado.lastInsertRowid === undefined ? undefined : BigInt(resultado.lastInsertRowid),
    };
  }

  // eslint-disable-next-line require-yield -- o Better Auth não usa streaming.
  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error('Streaming não é suportado pelo dialeto libSQL do login.');
  }
}

/**
 * Sem transações interativas: num cliente compartilhado elas misturariam comandos de requisições
 * diferentes. O Better Auth é configurado com `transaction: false` e grava passo a passo.
 */
class DriverLibsql implements Driver {
  private readonly conexao: ConexaoLibsql;

  constructor(cliente: Client) {
    this.conexao = new ConexaoLibsql(cliente);
  }

  async init(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    return this.conexao;
  }

  async beginTransaction(): Promise<void> {
    throw new Error('Transações não são suportadas pelo dialeto libSQL do login.');
  }

  async commitTransaction(): Promise<void> {
    throw new Error('Transações não são suportadas pelo dialeto libSQL do login.');
  }

  async rollbackTransaction(): Promise<void> {
    throw new Error('Transações não são suportadas pelo dialeto libSQL do login.');
  }

  async releaseConnection(): Promise<void> {}

  // O cliente é do registro do histórico: quem o abriu é quem fecha.
  async destroy(): Promise<void> {}
}

export class DialetoLibsql implements Dialect {
  constructor(private readonly cliente: Client) {}

  createDriver(): Driver {
    return new DriverLibsql(this.cliente);
  }

  createQueryCompiler(): SqliteQueryCompiler {
    return new SqliteQueryCompiler();
  }

  createAdapter(): SqliteAdapter {
    return new SqliteAdapter();
  }

  createIntrospector(db: Parameters<Dialect['createIntrospector']>[0]): SqliteIntrospector {
    return new SqliteIntrospector(db);
  }
}
