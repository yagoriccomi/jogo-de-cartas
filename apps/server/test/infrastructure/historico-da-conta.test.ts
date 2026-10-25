import type { Client } from '@libsql/client';
import {
  caminhoDaRodadaDoReplay,
  ROTAS_DO_HISTORICO,
  type ErroDoHistorico,
  type PaginaDoHistorico,
  type RodadaDoReplay,
} from '@fodinha/shared';
import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { HistoricoDaConta } from '../../src/application/historico-da-conta';
import type { ContaDeLogin, LeituraDoHistorico } from '../../src/application/portas';
import { exigirPartidaTerminada, lancesDaRodada } from '../../src/domain/replay';
import { LeituraDoHistoricoLibsql } from '../../src/infrastructure/historico/leitura-libsql';
import { LeituraDoHistoricoNula } from '../../src/infrastructure/historico/leitura-nula';
import {
  codificarCursor,
  decodificarCursor,
  lerLimite,
  registrarRotasDoHistorico,
} from '../../src/infrastructure/historico/rotas-do-historico';
import {
  semearReplay,
  CONTA_DE_DEMONSTRACAO,
} from '../../src/infrastructure/historico/semear-replay';
import { bancoEmMemoria, gravarPartidaCompleta } from './apoio-do-banco';

const silencioso = { info: () => {}, warn: () => {}, error: () => {} };
const ANA: ContaDeLogin = { id: 'conta-ana', nome: 'Ana Souza', email: 'ana@fodinha.test' };
const BRUNO: ContaDeLogin = { id: 'conta-bruno', nome: 'Bruno', email: 'bruno@fodinha.test' };
const abertos: Client[] = [];

afterEach(() => {
  for (const cliente of abertos.splice(0)) cliente.close();
});

/** Uma partida terminada de Ana contra dois bots, com o assento humano ligado à conta dela. */
async function bancoComPartidaDaAna() {
  const cliente = await bancoEmMemoria();
  abertos.push(cliente);
  const { cenario, ana } = await gravarPartidaCompleta(cliente);
  await cliente.execute({
    sql: "UPDATE participantes_da_partida SET conta_id = ? WHERE tipo = 'humano'",
    args: [ANA.id],
  });
  const idPartida = String((await cliente.execute('SELECT id FROM partidas')).rows[0]?.id);
  const historico = new HistoricoDaConta(new LeituraDoHistoricoLibsql(cliente), silencioso);
  return { cliente, cenario, ana, idPartida, historico };
}

/** Copia a partida gravada com outro id e outro início, para testar a paginação. */
async function duplicarPartida(cliente: Client, origem: string, novoId: string, inicio: number) {
  await cliente.batch(
    [
      {
        sql: `INSERT INTO partidas SELECT ?, ?, encerrada_em, desfecho, configuracao,
              rodadas_gravadas, versao_do_diario FROM partidas WHERE id = ?`,
        args: [novoId, inicio, origem],
      },
      {
        sql: `INSERT INTO participantes_da_partida SELECT ?, jogador_id, tipo, perfil, colocacao,
              vidas_finais, conta_id FROM participantes_da_partida WHERE partida_id = ?`,
        args: [novoId, origem],
      },
      {
        sql: `INSERT INTO rodadas SELECT ?, numero, gravada_em, dados FROM rodadas
              WHERE partida_id = ?`,
        args: [novoId, origem],
      },
    ],
    'write',
  );
}

describe('Minhas partidas', () => {
  it('lista só as partidas terminadas da conta, com jogadores, rodadas e colocação', async () => {
    const { historico, idPartida, cenario, ana } = await bancoComPartidaDaAna();
    const resultado = await historico.pagina({ conta: ANA, depoisDe: null, limite: 20 });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    const [partida] = resultado.dados.partidas;
    expect(resultado.dados.partidas).toHaveLength(1);
    expect(resultado.dados.proximo).toBeNull();
    expect(partida).toMatchObject({ id: idPartida, jogadores: 3 });
    expect(partida?.rodadas).toBe(cenario.partidaDe(ana)?.numeroRodada);
    const venceu = cenario.partidaDe(ana)?.vencedores.includes(ana.jogadorId) ?? false;
    expect(partida?.venceu).toBe(venceu);
    expect(partida?.encerradaEm).toBeGreaterThanOrEqual(partida?.iniciadaEm ?? Infinity);

    const outra = await historico.pagina({ conta: BRUNO, depoisDe: null, limite: 20 });
    expect(outra).toEqual({ ok: true, dados: { partidas: [], proximo: null } });
  });

  it('pagina pelo cursor, da mais recente para trás, sem repetir nem pular', async () => {
    const { cliente, historico, idPartida } = await bancoComPartidaDaAna();
    // Duas com o mesmo início: o id desempata e o cursor não perde nenhuma.
    await duplicarPartida(cliente, idPartida, 'b-copia', 9_000_000_000_000);
    await duplicarPartida(cliente, idPartida, 'a-copia', 9_000_000_000_000);
    await duplicarPartida(cliente, idPartida, 'antiga', 8_000_000_000_000);
    await cliente.execute({
      sql: "UPDATE partidas SET desfecho = 'interrompida' WHERE id = ?",
      args: ['antiga'],
    });

    const vistas: string[] = [];
    let depoisDe = null;
    for (let pagina = 0; pagina < 5; pagina++) {
      const resultado = await historico.pagina({ conta: ANA, depoisDe, limite: 2 });
      if (!resultado.ok) throw new Error(resultado.motivo);
      vistas.push(...resultado.dados.partidas.map((partida) => partida.id));
      depoisDe = resultado.dados.proximo;
      if (!depoisDe) break;
    }
    // A interrompida não entra: não tem replay.
    expect(vistas).toEqual(['b-copia', 'a-copia', idPartida]);
  });

  it('com o histórico desligado, responde desligado', async () => {
    const historico = new HistoricoDaConta(new LeituraDoHistoricoNula(), silencioso);
    expect(await historico.pagina({ conta: ANA, depoisDe: null, limite: 5 })).toEqual({
      ok: false,
      motivo: 'desligado',
    });
  });
});

describe('Replay de uma rodada', () => {
  it('só quem jogou abre; para os outros, a partida não existe', async () => {
    const { historico, idPartida } = await bancoComPartidaDaAna();
    expect(await historico.rodada({ conta: BRUNO, idPartida, numero: 1 })).toEqual({
      ok: false,
      motivo: 'nao_encontrada',
    });
    expect(await historico.rodada({ conta: ANA, idPartida: 'nao-existe', numero: 1 })).toEqual({
      ok: false,
      motivo: 'nao_encontrada',
    });
  });

  it('partida inacabada não abre, nem por acesso direto', async () => {
    const { cliente, historico, idPartida } = await bancoComPartidaDaAna();
    for (const desfecho of ['interrompida', 'abandonada', null]) {
      await cliente.execute({
        sql: 'UPDATE partidas SET desfecho = ? WHERE id = ?',
        args: [desfecho, idPartida],
      });
      expect(await historico.rodada({ conta: ANA, idPartida, numero: 1 })).toEqual({
        ok: false,
        motivo: 'inacabada',
      });
    }
    expect(() => exigirPartidaTerminada('interrompida')).toThrow('Só partidas terminadas');
  });

  it('rodada fora da partida é pedido inválido', async () => {
    const { historico, idPartida, cenario, ana } = await bancoComPartidaDaAna();
    const total = cenario.partidaDe(ana)?.numeroRodada ?? 0;
    expect(await historico.rodada({ conta: ANA, idPartida, numero: total + 1 })).toEqual({
      ok: false,
      motivo: 'invalido',
    });
  });

  it('cada rodada vira lances do começo ao resultado, vistos do assento da conta', async () => {
    const { historico, idPartida, cenario, ana } = await bancoComPartidaDaAna();
    const total = cenario.partidaDe(ana)?.numeroRodada ?? 0;
    for (let numero = 1; numero <= total; numero++) {
      const resultado = await historico.rodada({ conta: ANA, idPartida, numero });
      if (!resultado.ok) throw new Error(`rodada ${numero}: ${resultado.motivo}`);
      const { lances, jogadorId, totalDeRodadas } = resultado.dados;
      expect(jogadorId).toBe(ana.jogadorId);
      expect(totalDeRodadas).toBe(total);
      const [primeiro] = lances;
      const ultimo = lances[lances.length - 1];
      expect(primeiro?.numeroRodada).toBe(numero);
      expect(primeiro?.fase).toBe('palpites');
      expect(['fim_de_rodada', 'encerrada']).toContain(ultimo?.fase);
      expect(ultimo?.resultadoRodada).not.toBeNull();
      // Ninguém corre contra o relógio no replay.
      for (const lance of lances) {
        expect(lance.prazoDaVezEm).toBeNull();
        expect(lance.pausa).toBeNull();
      }
    }
    const ultima = await historico.rodada({ conta: ANA, idPartida, numero: total });
    if (!ultima.ok) throw new Error(ultima.motivo);
    expect(ultima.dados.lances.at(-1)?.fase).toBe('encerrada');
  });

  it('com a partida terminada, as mãos dos outros vêm reveladas; a própria cega, nunca', async () => {
    const { historico, idPartida, ana } = await bancoComPartidaDaAna();
    // Rodada 1 é cega (1 carta); a 2 tem 2 cartas.
    const cega = await historico.rodada({ conta: ANA, idPartida, numero: 1 });
    const aberta = await historico.rodada({ conta: ANA, idPartida, numero: 2 });
    if (!cega.ok || !aberta.ok) throw new Error('replay não abriu');

    const inicioCego = cega.dados.lances[0];
    expect(inicioCego?.minhaMao.every((carta) => 'oculta' in carta && carta.oculta)).toBe(true);
    const eu = inicioCego?.jogadores.find((jogador) => jogador.id === ana.jogadorId);
    expect(eu?.maoRevelada).toBeNull();

    const inicio = aberta.dados.lances[0];
    for (const jogador of inicio?.jogadores ?? []) {
      if (jogador.id === ana.jogadorId) expect(jogador.maoRevelada).toBeNull();
      else if (!jogador.eliminado) expect(jogador.maoRevelada).toHaveLength(2);
    }
    // Nomes: a conta vê o próprio primeiro nome; os bots, numerados. Nenhum apelido gravado.
    expect(inicio?.jogadores.map((jogador) => jogador.apelido).sort()).toEqual(
      ['Ana', 'Bot 1', 'Bot 2'].sort(),
    );
  });

  it('ao vivo, ninguém vivo recebe mão alheia (a regra de antes continua)', async () => {
    const { cenario, ana } = await bancoComPartidaDaAna();
    const estado = cenario.partidaDe(ana);
    for (const jogador of estado?.jogadores ?? []) expect(jogador.maoRevelada).toBeNull();
  });

  it('o domínio recusa o replay de partida sem fim', () => {
    expect(() =>
      lancesDaRodada({
        configuracao: {} as never,
        motivoDoFim: null,
        rodadas: [],
        observadorId: 'x',
        assentos: new Map(),
      }),
    ).toThrow('Só partidas terminadas');
  });
});

describe('Rotas do histórico', () => {
  const TOKEN = 'token-da-ana';
  const login = {
    ligado: true,
    contaDoToken: async (token: string) => (token === TOKEN ? ANA : null),
  };

  async function servidor(leitura: LeituraDoHistorico, ligado = true) {
    const http = Fastify();
    registrarRotasDoHistorico(http, {
      historico: new HistoricoDaConta(leitura, silencioso),
      login: { ...login, ligado },
      registrador: silencioso,
    });
    await http.ready();
    return http;
  }

  it('sem token, 401; com o banco desligado, 503; parâmetro torto, 400', async () => {
    const { cliente } = await bancoComPartidaDaAna();
    const http = await servidor(new LeituraDoHistoricoLibsql(cliente));
    const semToken = await http.inject({ url: ROTAS_DO_HISTORICO.partidas });
    expect(semToken.statusCode).toBe(401);
    expect(semToken.json<ErroDoHistorico>().motivo).toBe('sem_login');

    const autorizacao = { authorization: `Bearer ${TOKEN}` };
    for (const consulta of ['?limite=0', '?limite=999', '?cursor=xyz']) {
      const torto = await http.inject({
        url: ROTAS_DO_HISTORICO.partidas + consulta,
        headers: autorizacao,
      });
      expect(torto.statusCode).toBe(400);
    }
    const rodadaTorta = await http.inject({
      url: caminhoDaRodadaDoReplay('qualquer', 0),
      headers: autorizacao,
    });
    expect(rodadaTorta.statusCode).toBe(400);

    const desligado = await servidor(new LeituraDoHistoricoNula());
    const resposta = await desligado.inject({
      url: ROTAS_DO_HISTORICO.partidas,
      headers: autorizacao,
    });
    expect(resposta.statusCode).toBe(503);
    expect(resposta.json<ErroDoHistorico>().motivo).toBe('desligado');
    await Promise.all([http.close(), desligado.close()]);
  });

  it('com login, lista e abre a rodada; partida alheia é 404', async () => {
    const { cliente, idPartida } = await bancoComPartidaDaAna();
    const http = await servidor(new LeituraDoHistoricoLibsql(cliente));
    const headers = { authorization: `Bearer ${TOKEN}` };
    const lista = await http.inject({ url: `${ROTAS_DO_HISTORICO.partidas}?limite=5`, headers });
    expect(lista.statusCode).toBe(200);
    expect(lista.json<PaginaDoHistorico>()).toMatchObject({ proximoCursor: null });
    expect(lista.json<PaginaDoHistorico>().partidas[0]?.id).toBe(idPartida);

    const rodada = await http.inject({ url: caminhoDaRodadaDoReplay(idPartida, 1), headers });
    expect(rodada.statusCode).toBe(200);
    expect(rodada.json<RodadaDoReplay>()).toMatchObject({ idPartida, numeroRodada: 1 });

    await cliente.execute('UPDATE participantes_da_partida SET conta_id = NULL');
    const alheia = await http.inject({ url: caminhoDaRodadaDoReplay(idPartida, 1), headers });
    expect(alheia.statusCode).toBe(404);
    await http.close();
  });

  it('o cursor vai e volta, e o limite respeita o teto', () => {
    const cursor = { iniciadaEm: 1_700_000_000_000, idPartida: 'abc.def' };
    expect(decodificarCursor(codificarCursor(cursor))).toEqual(cursor);
    expect(decodificarCursor(undefined)).toBeUndefined();
    expect(decodificarCursor('sem-ponto')).toBeNull();
    expect(lerLimite(undefined)).toBe(20);
    expect(lerLimite('21')).toBeNull();
  });
});

describe('Semente do replay (só desenvolvimento)', () => {
  it('grava conta, sessão e uma partida terminada; rodar de novo não duplica', async () => {
    const cliente = await bancoEmMemoria();
    abertos.push(cliente);
    expect(await semearReplay(cliente, 'token-demo', 1_000)).toEqual({ partidaNova: true });
    expect(await semearReplay(cliente, 'token-demo', 2_000)).toEqual({ partidaNova: false });

    const sessao = await cliente.execute('SELECT userId FROM "session" WHERE token = ?', [
      'token-demo',
    ]);
    expect(sessao.rows[0]?.userId).toBe(CONTA_DE_DEMONSTRACAO.id);
    const historico = new HistoricoDaConta(new LeituraDoHistoricoLibsql(cliente), silencioso);
    const conta = { ...CONTA_DE_DEMONSTRACAO };
    const pagina = await historico.pagina({ conta, depoisDe: null, limite: 5 });
    if (!pagina.ok) throw new Error(pagina.motivo);
    expect(pagina.dados.partidas).toHaveLength(1);
    const [partida] = pagina.dados.partidas;
    const ultima = await historico.rodada({
      conta,
      idPartida: partida?.id ?? '',
      numero: partida?.rodadas ?? 0,
    });
    expect(ultima.ok && ultima.dados.lances.at(-1)?.fase).toBe('encerrada');
  });
});
