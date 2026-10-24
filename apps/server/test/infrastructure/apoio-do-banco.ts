import { createClient, type Client } from '@libsql/client';
import { aplicarMigracoes, lerMigracoes } from '../../src/infrastructure/historico/migracoes';
import { RegistroDePartidasLibsql } from '../../src/infrastructure/historico/registro-libsql';
import { ATRASO_BOT_MS, ator, montarCenario, PAUSA_FIM_RODADA_MS } from '../apoio';

export const PASTA_DAS_MIGRACOES = new URL('../../migrations/', import.meta.url);

const PASSOS_ATE_O_FIM = 400;

/** Cada cliente `file::memory:` é um banco novo e vazio. */
export async function bancoEmMemoria(): Promise<Client> {
  const cliente = createClient({ url: 'file::memory:' });
  await aplicarMigracoes(cliente, await lerMigracoes(PASTA_DAS_MIGRACOES));
  return cliente;
}

/** Ana contra dois bots, do início ao fim, gravando no banco informado. */
export async function gravarPartidaCompleta(cliente: Client) {
  const cenario = montarCenario({}, undefined, undefined, new RegistroDePartidasLibsql(cliente));
  const ana = cenario.criarSala('Ana');
  cenario.servico.adicionarBot(ator(ana));
  cenario.servico.adicionarBot(ator(ana));
  cenario.servico.iniciarPartida(ator(ana));
  for (let passo = 0; passo < PASSOS_ATE_O_FIM; passo++) {
    if (cenario.partidaDe(ana)?.fase === 'encerrada') break;
    cenario.humanosJogam([ana]);
    cenario.relogio.avancar(ATRASO_BOT_MS + PAUSA_FIM_RODADA_MS);
  }
  await cenario.historico.aguardarGravacoes();
  return { cenario, ana };
}
