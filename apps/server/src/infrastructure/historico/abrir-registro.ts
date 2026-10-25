import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import type { LeituraDoHistorico, RegistroDePartidas, Registrador } from '../../application/portas';
import type { BancoDoHistorico } from '../ambiente';
import { LeituraDoHistoricoLibsql } from './leitura-libsql';
import { LeituraDoHistoricoNula } from './leitura-nula';
import { aplicarMigracoes, lerMigracoes } from './migracoes';
import { RegistroDePartidasLibsql } from './registro-libsql';
import { RegistroDePartidasNulo } from './registro-nulo';

export interface RegistroAberto {
  readonly registro: RegistroDePartidas;
  /** "Minhas partidas" e o replay leem pelo mesmo banco. */
  readonly leitura: LeituraDoHistorico;
  /** O banco aberto, com as migrations aplicadas; o login guarda as sessões nele. `null` = sem banco. */
  readonly cliente: Client | null;
  /** Libera a conexão no desligamento. */
  fechar(): void;
}

const PREFIXO_DE_ARQUIVO = 'file:';
const BANCO_EM_MEMORIA = ':memory:';

export function conectar(banco: BancoDoHistorico): Client {
  return createClient({ url: banco.url, authToken: banco.tokenDeAcesso ?? undefined });
}

/** O libSQL cria o arquivo, mas não a pasta: `file:./dados/fodinha.db` funciona de primeira. */
export async function prepararArquivoLocal(url: string): Promise<void> {
  if (!url.startsWith(PREFIXO_DE_ARQUIVO)) return;
  const caminho = url.slice(PREFIXO_DE_ARQUIVO.length).split('?')[0] ?? '';
  if (caminho === '' || caminho === BANCO_EM_MEMORIA) return;
  await mkdir(dirname(caminho), { recursive: true });
}

function semBanco(): RegistroAberto {
  return {
    registro: new RegistroDePartidasNulo(),
    leitura: new LeituraDoHistoricoNula(),
    cliente: null,
    fechar: () => {},
  };
}

/**
 * Sem banco configurado, o registro nulo. Com banco, aplica as migrations antes de aceitar
 * gravações. Se o banco não responder na subida, o jogo sobe mesmo assim, sem histórico: perder a
 * gravação é melhor do que deixar todo mundo sem jogar.
 */
export async function abrirRegistroDePartidas(
  banco: BancoDoHistorico | null,
  pastaDasMigracoes: URL,
  registrador: Registrador,
): Promise<RegistroAberto> {
  if (!banco) {
    registrador.info({}, 'Histórico de partidas desligado (sem TURSO_DATABASE_URL)');
    return semBanco();
  }
  let cliente: Client | null = null;
  try {
    await prepararArquivoLocal(banco.url);
    cliente = conectar(banco);
    const aplicadas = await aplicarMigracoes(cliente, await lerMigracoes(pastaDasMigracoes));
    registrador.info({ migracoesAplicadas: aplicadas }, 'Histórico de partidas ligado');
    const aberto = cliente;
    return {
      registro: new RegistroDePartidasLibsql(aberto),
      leitura: new LeituraDoHistoricoLibsql(aberto),
      cliente: aberto,
      fechar: () => aberto.close(),
    };
  } catch (erro) {
    cliente?.close();
    registrador.error({ erro }, 'Banco do histórico indisponível: partidas não serão gravadas');
    return semBanco();
  }
}
