import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import { parseArgs } from 'node:util';
import { lerBancoDoHistorico } from './infrastructure/ambiente';
import { conectar } from './infrastructure/historico/abrir-registro';
import { exportarParaTreino } from './infrastructure/historico/exportar-treino';

/**
 * `npm run exportar-treino -w apps/server -- [--url <banco>] [--saida <arquivo.jsonl>]`
 * O banco vem de `--url` ou de TURSO_DATABASE_URL (com TURSO_AUTH_TOKEN, para o Turso). Sem
 * `--saida`, o JSONL sai na saída padrão; o resumo vai para a saída de erro.
 */
async function exportar(): Promise<void> {
  const { values } = parseArgs({
    options: { url: { type: 'string' }, saida: { type: 'string' } },
  });
  const banco = lerBancoDoHistorico(undefined, values.url);
  if (!banco) {
    throw new Error('Informe o banco: --url file:./dados/fodinha.db ou TURSO_DATABASE_URL.');
  }
  const destino = values.saida ? createWriteStream(values.saida) : process.stdout;
  const cliente = conectar(banco);
  try {
    const resumo = await exportarParaTreino(cliente, async (linha) => {
      if (!destino.write(`${linha}\n`)) await once(destino, 'drain');
    });
    console.error(
      `Exportadas ${resumo.linhas} decisões (${resumo.rodadasIgnoradas} rodadas ignoradas).`,
    );
  } finally {
    cliente.close();
    if (destino !== process.stdout) destino.end();
  }
}

exportar().catch((erro: unknown) => {
  console.error('Falha ao exportar para treino:', erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
