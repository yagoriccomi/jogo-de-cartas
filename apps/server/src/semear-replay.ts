import { parseArgs } from 'node:util';
import { conectar, prepararArquivoLocal } from './infrastructure/historico/abrir-registro';
import { aplicarMigracoes, lerMigracoes } from './infrastructure/historico/migracoes';
import { semearReplay } from './infrastructure/historico/semear-replay';

const PASTA_DAS_MIGRACOES = new URL('../migrations/', import.meta.url);
const PREFIXO_DE_ARQUIVO = 'file:';

/**
 * `npm run semear-replay -w apps/server -- --url file:./dados/fodinha.db --token <token>`
 * Só desenvolvimento: grava uma conta de demonstração com sessão de login e uma partida terminada,
 * para abrir "Minhas partidas" e o replay sem Google. Recusa qualquer banco que não seja arquivo
 * local: nunca semeia o Turso.
 */
async function semear(): Promise<void> {
  const { values } = parseArgs({
    options: { url: { type: 'string' }, token: { type: 'string' } },
  });
  const url = values.url ?? '';
  if (!url.startsWith(PREFIXO_DE_ARQUIVO)) {
    throw new Error('Informe um banco local: --url file:./dados/fodinha.db (nunca o Turso).');
  }
  if (!values.token) throw new Error('Informe o token da sessão de demonstração: --token <token>.');
  await prepararArquivoLocal(url);
  const cliente = conectar({ url, tokenDeAcesso: null });
  try {
    await aplicarMigracoes(cliente, await lerMigracoes(PASTA_DAS_MIGRACOES));
    const { partidaNova } = await semearReplay(cliente, values.token, Date.now());
    console.error(partidaNova ? 'Partida de demonstração gravada.' : 'Sessão renovada.');
  } finally {
    cliente.close();
  }
}

semear().catch((erro: unknown) => {
  console.error('Falha ao semear o replay:', erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
