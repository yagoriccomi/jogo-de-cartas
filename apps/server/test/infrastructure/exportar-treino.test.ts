import { afterEach, describe, expect, it } from 'vitest';
import {
  exportarParaTreino,
  type LinhaDeTreino,
} from '../../src/infrastructure/historico/exportar-treino';
import { bancoEmMemoria, gravarPartidaCompleta } from './apoio-do-banco';

const abertos: { close(): void }[] = [];

afterEach(() => {
  for (const cliente of abertos.splice(0)) cliente.close();
});

const CAMPOS_DA_LINHA = [
  'autor',
  'cega',
  'decisao',
  'desfecho',
  'jogadorId',
  'ordem',
  'partida',
  'rodada',
  'visao',
];

describe('Export para treino', () => {
  it('escreve uma linha JSON por decisão, com visão, autor e desfecho, sem apelido', async () => {
    const cliente = await bancoEmMemoria();
    abertos.push(cliente);
    const { cenario, ana } = await gravarPartidaCompleta(cliente);
    const linhas: string[] = [];

    const resumo = await exportarParaTreino(cliente, (linha) => void linhas.push(linha));

    expect(resumo).toEqual({ linhas: linhas.length, rodadasIgnoradas: 0 });
    const decisoes = linhas.map((linha) => JSON.parse(linha) as LinhaDeTreino);
    const [primeira] = decisoes;
    expect(Object.keys(primeira ?? {}).sort()).toEqual(CAMPOS_DA_LINHA);
    expect(primeira).toMatchObject({
      rodada: 1,
      cega: true,
      ordem: 0,
      decisao: { tipo: 'palpite' },
    });
    expect(primeira?.visao.minhaMao.every((carta) => 'oculta' in carta)).toBe(true);
    expect(primeira?.desfecho).toEqual({
      palpite: expect.any(Number),
      vazasFeitas: expect.any(Number),
      vidasPerdidas: expect.any(Number),
      vidasDepois: expect.any(Number),
    });

    const carta = decisoes.find((d) => d.decisao.tipo === 'carta');
    expect(carta?.decisao).toMatchObject({
      vaza: expect.any(Number),
      venceuAVaza: expect.any(Boolean),
    });
    expect(new Set(decisoes.map((d) => d.autor.tipo))).toEqual(new Set(['humano', 'bot']));

    const texto = linhas.join('\n');
    for (const { apelido } of cenario.salaDe(ana)?.participantes ?? []) {
      expect(texto).not.toContain(apelido);
    }
  });

  it('rodada ilegível ou de outra versão fica de fora, contada', async () => {
    const cliente = await bancoEmMemoria();
    abertos.push(cliente);
    await cliente.execute(
      `INSERT INTO partidas (id, iniciada_em, configuracao, versao_do_diario)
       VALUES ('p', 0, '{}', 1)`,
    );
    await cliente.execute({
      sql: `INSERT INTO rodadas (partida_id, numero, gravada_em, dados)
            VALUES ('p', 1, 0, ?), ('p', 2, 0, ?)`,
      args: ['quebrado', JSON.stringify({ versao: 99 })],
    });
    const resumo = await exportarParaTreino(cliente, () => {});
    expect(resumo).toEqual({ linhas: 0, rodadasIgnoradas: 2 });
  });
});
