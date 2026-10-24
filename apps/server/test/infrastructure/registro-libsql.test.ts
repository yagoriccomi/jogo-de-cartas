import { createClient } from '@libsql/client';
import { afterEach, describe, expect, it } from 'vitest';
import { VERSAO_DO_DIARIO } from '../../src/domain/diario';
import { abrirRegistroDePartidas } from '../../src/infrastructure/historico/abrir-registro';
import {
  aplicarMigracoes,
  comandosDe,
  lerMigracoes,
} from '../../src/infrastructure/historico/migracoes';
import { RegistroDePartidasLibsql } from '../../src/infrastructure/historico/registro-libsql';
import { RegistroDePartidasNulo } from '../../src/infrastructure/historico/registro-nulo';
import { bancoEmMemoria, gravarPartidaCompleta, PASTA_DAS_MIGRACOES } from './apoio-do-banco';

const silencioso = { info: () => {}, warn: () => {}, error: () => {} };
const abertos: { close(): void }[] = [];

afterEach(() => {
  for (const cliente of abertos.splice(0)) cliente.close();
});

describe('Migrations do histórico', () => {
  it('aplicam do zero e, rodando de novo, não fazem nada', async () => {
    const cliente = createClient({ url: 'file::memory:' });
    abertos.push(cliente);
    const migracoes = await lerMigracoes(PASTA_DAS_MIGRACOES);
    expect(migracoes.map((m) => m.versao)).toContain('0001_historico_de_partidas');

    expect(await aplicarMigracoes(cliente, migracoes)).toEqual(migracoes.map((m) => m.versao));
    expect(await aplicarMigracoes(cliente, migracoes)).toEqual([]);

    const tabelas = await cliente.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(tabelas.rows.map((linha) => linha.name)).toEqual(
      expect.arrayContaining([
        'migracoes_aplicadas',
        'participantes_da_partida',
        'partidas',
        'rodadas',
      ]),
    );
  });

  it('os comandos de um arquivo saem sem comentários, cortados no ponto e vírgula', () => {
    const sql = '-- só comentário\nCREATE TABLE a (x); -- fim\n\nCREATE INDEX i ON a (x);\n';
    expect(comandosDe(sql)).toEqual(['CREATE TABLE a (x)', 'CREATE INDEX i ON a (x)']);
  });
});

describe('Registro de partidas no libSQL', () => {
  it('ida e volta: a partida, os participantes e cada rodada voltam do banco', async () => {
    const cliente = await bancoEmMemoria();
    abertos.push(cliente);
    const { cenario, ana } = await gravarPartidaCompleta(cliente);
    expect(cenario.errosDoHistorico).toEqual([]);
    const rodadasJogadas = cenario.partidaDe(ana)?.numeroRodada ?? 0;

    const partidas = await cliente.execute('SELECT * FROM partidas');
    expect(partidas.rows).toHaveLength(1);
    const [partida] = partidas.rows;
    expect(partida?.desfecho).toBe('fim');
    expect(partida?.rodadas_gravadas).toBe(rodadasJogadas);
    expect(Number(partida?.encerrada_em)).toBeGreaterThanOrEqual(Number(partida?.iniciada_em));

    const participantes = await cliente.execute(
      'SELECT tipo, perfil, colocacao, conta_id FROM participantes_da_partida ORDER BY colocacao',
    );
    expect(participantes.rows).toHaveLength(3);
    expect(participantes.rows[0]?.colocacao).toBe(1);
    expect(participantes.rows.every((p) => p.conta_id === null)).toBe(true);
    expect(participantes.rows.filter((p) => p.tipo === 'bot').every((p) => p.perfil)).toBe(true);

    const rodadas = await cliente.execute('SELECT numero, dados FROM rodadas ORDER BY numero');
    expect(rodadas.rows.map((r) => r.numero)).toEqual(
      Array.from({ length: rodadasJogadas }, (_, i) => i + 1),
    );
    for (const linha of rodadas.rows) {
      const dados: unknown = JSON.parse(String(linha.dados));
      expect(dados).toMatchObject({ versao: VERSAO_DO_DIARIO, numero: linha.numero });
    }
  });

  it('sem banco configurado, o registro é nulo', async () => {
    const aberto = await abrirRegistroDePartidas(null, PASTA_DAS_MIGRACOES, silencioso);
    expect(aberto.registro).toBeInstanceOf(RegistroDePartidasNulo);
  });

  it('com banco, aplica as migrations e grava no libSQL', async () => {
    const aberto = await abrirRegistroDePartidas(
      { url: 'file::memory:', tokenDeAcesso: null },
      PASTA_DAS_MIGRACOES,
      silencioso,
    );
    abertos.push({ close: aberto.fechar });
    expect(aberto.registro).toBeInstanceOf(RegistroDePartidasLibsql);
  });

  it('banco que não abre na subida vira registro nulo, com o erro no log', async () => {
    const erros: unknown[] = [];
    const aberto = await abrirRegistroDePartidas(
      { url: 'file::memory:', tokenDeAcesso: null },
      new URL('./pasta-que-nao-existe/', PASTA_DAS_MIGRACOES),
      { ...silencioso, error: (dados) => void erros.push(dados) },
    );
    expect(aberto.registro).toBeInstanceOf(RegistroDePartidasNulo);
    expect(erros).toHaveLength(1);
  });
});
