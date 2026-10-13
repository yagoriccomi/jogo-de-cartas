import { CONFIGURACAO_PADRAO, type EstadoPartidaVisivel, type EstadoSala } from '@fodinha/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CondutorDePartidas } from '../../src/application/condutor-de-partidas';
import type { Notificador, Relogio } from '../../src/application/portas';
import { ServicoDeSalas } from '../../src/application/servico-de-salas';
import { EstrategiaSimples } from '../../src/domain/estrategia-bot';
import { RepositorioDeSalasEmMemoria } from '../../src/infrastructure/adaptadores';
import { geradorComSemente } from '../apoio';

const PRAZO_MS = 30_000;

/** Relógio controlado manualmente: `avancar` dispara os agendamentos vencidos, em ordem. */
class RelogioFalso implements Relogio {
  private instante = 0;
  private sequencia = 0;
  private agendados: { quando: number; ordem: number; acao: () => void }[] = [];

  agora(): number {
    return this.instante;
  }

  agendar(atrasoMs: number, acao: () => void): () => void {
    const item = { quando: this.instante + atrasoMs, ordem: this.sequencia++, acao };
    this.agendados.push(item);
    return () => {
      this.agendados = this.agendados.filter((a) => a !== item);
    };
  }

  avancar(ms: number): void {
    const alvo = this.instante + ms;
    for (;;) {
      const proximo = [...this.agendados]
        .filter((a) => a.quando <= alvo)
        .sort((a, b) => a.quando - b.quando || a.ordem - b.ordem)[0];
      if (!proximo) break;
      this.agendados = this.agendados.filter((a) => a !== proximo);
      this.instante = proximo.quando;
      proximo.acao();
    }
    this.instante = alvo;
  }
}

class NotificadorFalso implements Notificador {
  readonly salas = new Map<string, EstadoSala>();
  readonly partidas = new Map<string, EstadoPartidaVisivel>();

  enviarEstadoSala(ids: readonly string[], estado: EstadoSala): void {
    for (const id of ids) this.salas.set(id, estado);
  }

  enviarEstadoPartida(id: string, estado: EstadoPartidaVisivel): void {
    this.partidas.set(id, estado);
  }
}

const silencioso = { info: () => {}, warn: () => {}, error: () => {} };

let relogio: RelogioFalso;
let notificador: NotificadorFalso;
let servico: ServicoDeSalas;
let contador: number;

beforeEach(() => {
  relogio = new RelogioFalso();
  notificador = new NotificadorFalso();
  contador = 0;
  const condutor = new CondutorDePartidas({
    notificador,
    relogio,
    estrategia: new EstrategiaSimples(),
    registrador: silencioso,
    tempos: { prazoDaVezMs: PRAZO_MS, atrasoDoBotMs: 900, pausaFimDeRodadaMs: 4_000 },
  });
  servico = new ServicoDeSalas({
    repositorio: new RepositorioDeSalasEmMemoria(),
    condutor,
    identificadores: {
      novoId: () => `id${++contador}`,
      novoToken: () => `token${++contador}`,
      novoCodigoSala: () => `SALA${++contador}`,
    },
    relogio,
    gerarAleatorio: geradorComSemente(3),
    registrador: silencioso,
    tempoDeAbandonoMs: 600_000,
  });
});

function criarSala() {
  return servico.criarSala({ apelido: 'Ana', configuracao: CONFIGURACAO_PADRAO });
}

const ator = (sessao: { codigoSala: string; jogadorId: string }) => ({
  codigoSala: sessao.codigoSala,
  jogadorId: sessao.jogadorId,
});

describe('ServicoDeSalas — lobby', () => {
  it('deveCriarSalaComOCriadorComoAnfitriao', () => {
    const sessao = criarSala();
    const estado = notificador.salas.get(sessao.jogadorId);
    expect(estado?.participantes).toEqual([
      expect.objectContaining({ apelido: 'Ana', ehAnfitriao: true, ehBot: false }),
    ]);
  });

  it('deveRejeitarApelidoVazioOuLongoDemais', () => {
    expect(() =>
      servico.criarSala({ apelido: '   ', configuracao: CONFIGURACAO_PADRAO }),
    ).toThrow();
    expect(() =>
      servico.criarSala({ apelido: 'x'.repeat(21), configuracao: CONFIGURACAO_PADRAO }),
    ).toThrow();
  });

  it('deveAceitarCodigoDaSalaEmMinusculas', () => {
    const anfitriao = criarSala();
    const convidado = servico.entrarSala({
      codigoSala: anfitriao.codigoSala.toLowerCase(),
      apelido: 'Bia',
    });
    expect(convidado.codigoSala).toBe(anfitriao.codigoSala);
  });

  it('deveLimitarA4BotsE10Participantes', () => {
    const anfitriao = criarSala();
    for (let i = 0; i < 4; i++) servico.adicionarBot(ator(anfitriao));
    expect(() => servico.adicionarBot(ator(anfitriao))).toThrow(
      expect.objectContaining({ codigo: 'SALA_CHEIA' }),
    );
    for (let i = 0; i < 5; i++)
      servico.entrarSala({ codigoSala: anfitriao.codigoSala, apelido: `J${i}` });
    expect(() =>
      servico.entrarSala({ codigoSala: anfitriao.codigoSala, apelido: 'Sobra' }),
    ).toThrow(expect.objectContaining({ codigo: 'SALA_CHEIA' }));
  });

  it('deveImpedirQueQuemNaoEhAnfitriaoInicieAPartida', () => {
    const anfitriao = criarSala();
    const convidado = servico.entrarSala({ codigoSala: anfitriao.codigoSala, apelido: 'Bia' });
    expect(() => servico.iniciarPartida(ator(convidado))).toThrow(
      expect.objectContaining({ codigo: 'SEM_PERMISSAO' }),
    );
  });

  it('deveExigirPeloMenosDoisParticipantes', () => {
    const anfitriao = criarSala();
    expect(() => servico.iniciarPartida(ator(anfitriao))).toThrow();
  });

  it('deveReconectarAoMesmoAssentoComOToken', () => {
    const anfitriao = criarSala();
    servico.desconectar(ator(anfitriao));
    const sessao = servico.reconectar({
      codigoSala: anfitriao.codigoSala,
      tokenSessao: anfitriao.tokenSessao,
    });
    expect(sessao.jogadorId).toBe(anfitriao.jogadorId);
    expect(() =>
      servico.reconectar({ codigoSala: anfitriao.codigoSala, tokenSessao: 'falso' }),
    ).toThrow(expect.objectContaining({ codigo: 'SEM_PERMISSAO' }));
  });

  it('deveRemoverASalaAbandonadaDepoisDoTempoLimite', () => {
    const anfitriao = criarSala();
    servico.desconectar(ator(anfitriao));
    relogio.avancar(600_000);
    expect(() =>
      servico.reconectar({ codigoSala: anfitriao.codigoSala, tokenSessao: anfitriao.tokenSessao }),
    ).toThrow(expect.objectContaining({ codigo: 'SALA_NAO_ENCONTRADA' }));
  });

  it('devePassarOAnfitriaoAdianteQuandoEleSai', () => {
    const anfitriao = criarSala();
    const convidado = servico.entrarSala({ codigoSala: anfitriao.codigoSala, apelido: 'Bia' });
    servico.sair(ator(anfitriao));
    const estado = notificador.salas.get(convidado.jogadorId);
    expect(estado?.participantes).toEqual([
      expect.objectContaining({ apelido: 'Bia', ehAnfitriao: true }),
    ]);
  });
});

describe('ServicoDeSalas — partida', () => {
  it('deveEnviarACadaJogadorApenasASuaVisao', () => {
    const anfitriao = criarSala();
    servico.adicionarBot(ator(anfitriao));
    servico.iniciarPartida(ator(anfitriao));
    const estado = notificador.partidas.get(anfitriao.jogadorId);
    expect(estado?.fase).toBe('palpites');
    expect(estado?.jogadores.map((j) => j.apelido)).toEqual(['Ana', 'Bot Zé']);
    // Rodada cega: o humano vê a carta do bot, mas não a própria.
    expect(estado?.jogadores[1]?.cartaNaTesta).not.toBeNull();
    expect(estado?.jogadores[0]?.cartaNaTesta).toBeNull();
  });

  it('deveJogarPeloHumanoQuandoOPrazoEstoura', () => {
    const anfitriao = criarSala();
    servico.adicionarBot(ator(anfitriao));
    servico.iniciarPartida(ator(anfitriao));

    relogio.avancar(1_000);
    const antes = notificador.partidas.get(anfitriao.jogadorId);
    expect(antes?.idDaVez).toBe(anfitriao.jogadorId);
    expect(antes?.prazoDaVezEm).toBeGreaterThan(relogio.agora());
    expect(antes?.jogadores[0]?.palpite).toBeNull();

    relogio.avancar(PRAZO_MS);
    expect(notificador.partidas.get(anfitriao.jogadorId)?.jogadores[0]?.palpite).not.toBeNull();
  });

  it('deveLevarAPartidaAteOFimSoComPrazosEBots', () => {
    const anfitriao = criarSala();
    for (let i = 0; i < 3; i++) servico.adicionarBot(ator(anfitriao));
    servico.iniciarPartida(ator(anfitriao));

    for (let passo = 0; passo < 2_000; passo++) {
      if (notificador.partidas.get(anfitriao.jogadorId)?.fase === 'encerrada') break;
      relogio.avancar(PRAZO_MS);
    }
    const final = notificador.partidas.get(anfitriao.jogadorId);
    expect(final?.fase).toBe('encerrada');
    expect(final?.vencedores.length).toBeGreaterThanOrEqual(1);
    expect(notificador.salas.get(anfitriao.jogadorId)?.emPartida).toBe(false);
  });

  it('deveColocarUmBotNoLugarDeQuemSaiDuranteAPartida', () => {
    const anfitriao = criarSala();
    const convidado = servico.entrarSala({ codigoSala: anfitriao.codigoSala, apelido: 'Bia' });
    servico.iniciarPartida(ator(anfitriao));
    servico.sair(ator(convidado));

    const estado = notificador.partidas.get(anfitriao.jogadorId);
    expect(estado?.jogadores.find((j) => j.apelido === 'Bia')?.ehBot).toBe(true);
    expect(() =>
      servico.reconectar({ codigoSala: anfitriao.codigoSala, tokenSessao: convidado.tokenSessao }),
    ).toThrow();
  });

  it('deveRecusarEntradaComPartidaEmAndamento', () => {
    const anfitriao = criarSala();
    servico.adicionarBot(ator(anfitriao));
    servico.iniciarPartida(ator(anfitriao));
    expect(() =>
      servico.entrarSala({ codigoSala: anfitriao.codigoSala, apelido: 'Tarde' }),
    ).toThrow(expect.objectContaining({ codigo: 'PARTIDA_EM_ANDAMENTO' }));
  });
});
