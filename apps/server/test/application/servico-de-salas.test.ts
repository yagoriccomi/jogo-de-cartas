import {
  CONFIGURACAO_PADRAO,
  LIMITES,
  type EstadoPartidaVisivel,
  type EstadoSala,
  type ReacaoNaMesa,
} from '@fodinha/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CondutorDePartidas } from '../../src/application/condutor-de-partidas';
import type { Notificador, Relogio } from '../../src/application/portas';
import { ServicoDeSalas } from '../../src/application/servico-de-salas';
import { EstrategiaSimples } from '../../src/domain/estrategia-bot';
import { RepositorioDeSalasEmMemoria } from '../../src/infrastructure/adaptadores';
import { BOTS_CALADOS, geradorComSemente } from '../apoio';

const PRAZO_MS = 30_000;
const CARENCIA_MS = 10_000;
const ATRASO_BOT_MS = 900;
const PAUSA_FIM_RODADA_MS = 4_000;

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
  readonly reacoes: { destinatarios: readonly string[]; reacao: ReacaoNaMesa }[] = [];

  enviarEstadoSala(ids: readonly string[], estado: EstadoSala): void {
    for (const id of ids) this.salas.set(id, estado);
  }

  enviarEstadoPartida(id: string, estado: EstadoPartidaVisivel): void {
    this.partidas.set(id, estado);
  }

  enviarReacao(destinatarios: readonly string[], reacao: ReacaoNaMesa): void {
    this.reacoes.push({ destinatarios, reacao });
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
    gerarAleatorio: BOTS_CALADOS,
    tempos: {
      atrasoDoBotMs: ATRASO_BOT_MS,
      pausaFimDeRodadaMs: PAUSA_FIM_RODADA_MS,
      pausaExtraRodadaCegaMs: 0,
      carenciaDeDesconexaoMs: CARENCIA_MS,
    },
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

type Sessao = ReturnType<ServicoDeSalas['criarSala']>;

function criarSala(dispositivoId = 'disp-ana') {
  return servico.criarSala({ apelido: 'Ana', configuracao: CONFIGURACAO_PADRAO, dispositivoId });
}

function entrar(sala: Sessao, apelido: string, dispositivoId = `disp-${apelido}`) {
  return servico.entrarSala({ codigoSala: sala.codigoSala, apelido, dispositivoId });
}

const ator = (sessao: { codigoSala: string; jogadorId: string }) => ({
  codigoSala: sessao.codigoSala,
  jogadorId: sessao.jogadorId,
});

const partidaDe = (sessao: Sessao) => notificador.partidas.get(sessao.jogadorId);
const salaDe = (sessao: Sessao) => notificador.salas.get(sessao.jogadorId);

/** Faz cada humano da lista agir (palpite ou carta) quando for a vez dele. */
function humanosJogam(humanos: readonly Sessao[]): void {
  for (let passo = 0; passo < 200; passo++) {
    const humano = humanos.find((h) => partidaDe(h)?.idDaVez === h.jogadorId);
    if (!humano) return;
    const estado = partidaDe(humano) as EstadoPartidaVisivel;
    if (estado.fase === 'palpites') {
      const proibido = estado.palpiteProibido;
      servico.palpitar(ator(humano), proibido === 0 ? 1 : 0);
    } else {
      servico.jogarCarta(ator(humano), (estado.minhaMao[0] as { id: string }).id);
    }
  }
}

describe('ServicoDeSalas — lobby', () => {
  it('deveCriarSalaComOCriadorComoDono', () => {
    const sessao = criarSala();
    expect(salaDe(sessao)?.participantes).toEqual([
      expect.objectContaining({ apelido: 'Ana', ehAnfitriao: true, ehBot: false }),
    ]);
  });

  it('deveExigirIdentificacaoDoNavegador', () => {
    expect(() =>
      servico.criarSala({ apelido: 'Ana', configuracao: CONFIGURACAO_PADRAO, dispositivoId: '' }),
    ).toThrow(expect.objectContaining({ codigo: 'ENTRADA_INVALIDA' }));
  });

  it('deveRejeitarApelidoVazioOuLongoDemais', () => {
    expect(() =>
      servico.criarSala({ apelido: '   ', configuracao: CONFIGURACAO_PADRAO, dispositivoId: 'd' }),
    ).toThrow();
    expect(() =>
      servico.criarSala({
        apelido: 'x'.repeat(21),
        configuracao: CONFIGURACAO_PADRAO,
        dispositivoId: 'd',
      }),
    ).toThrow();
  });

  it('deveAceitarCodigoDaSalaEmMinusculas', () => {
    const dono = criarSala();
    const convidado = servico.entrarSala({
      codigoSala: dono.codigoSala.toLowerCase(),
      apelido: 'Bia',
      dispositivoId: 'disp-bia',
    });
    expect(convidado.codigoSala).toBe(dono.codigoSala);
  });

  it('deveSortearUmApelidoDeBotDiferenteACadaBotAteAcabarem', () => {
    const dono = criarSala();
    for (let i = 0; i < 4; i++) servico.adicionarBot(ator(dono));
    const apelidos = (salaDe(dono)?.participantes ?? [])
      .filter((p) => p.ehBot)
      .map((p) => p.apelido);
    expect([...apelidos].sort()).toEqual(
      ['Jacinto Leite', 'Paula Tejano', 'Simas Turbo', 'Toko Kunavara'].sort(),
    );
  });

  it('deveLimitarA4BotsE10Participantes', () => {
    const dono = criarSala();
    for (let i = 0; i < 4; i++) servico.adicionarBot(ator(dono));
    expect(() => servico.adicionarBot(ator(dono))).toThrow(
      expect.objectContaining({ codigo: 'SALA_CHEIA' }),
    );
    for (let i = 0; i < 5; i++) entrar(dono, `J${i}`);
    expect(() => entrar(dono, 'Sobra')).toThrow(expect.objectContaining({ codigo: 'SALA_CHEIA' }));
  });

  it('deveImpedirQueQuemNaoEhDonoInicieReinicieOuExpulse', () => {
    const dono = criarSala();
    const convidado = entrar(dono, 'Bia');
    const sem = expect.objectContaining({ codigo: 'SEM_PERMISSAO' });
    expect(() => servico.iniciarPartida(ator(convidado))).toThrow(sem);
    expect(() => servico.expulsar(ator(convidado), dono.jogadorId)).toThrow(sem);
    servico.iniciarPartida(ator(dono));
    expect(() => servico.reiniciar(ator(convidado))).toThrow(sem);
  });

  it('deveExigirPeloMenosDoisParticipantes', () => {
    const dono = criarSala();
    expect(() => servico.iniciarPartida(ator(dono))).toThrow();
  });

  it('deveReconectarAoMesmoAssentoComOToken', () => {
    const dono = criarSala();
    servico.desconectar(ator(dono));
    const sessao = servico.reconectar({
      codigoSala: dono.codigoSala,
      tokenSessao: dono.tokenSessao,
      dispositivoId: 'disp-ana',
    });
    expect(sessao.jogadorId).toBe(dono.jogadorId);
    expect(() =>
      servico.reconectar({
        codigoSala: dono.codigoSala,
        tokenSessao: 'falso',
        dispositivoId: 'disp-ana',
      }),
    ).toThrow(expect.objectContaining({ codigo: 'SEM_PERMISSAO' }));
  });

  it('deveRemoverASalaAbandonadaDepoisDoTempoLimite', () => {
    const dono = criarSala();
    servico.desconectar(ator(dono));
    relogio.avancar(600_000);
    expect(() =>
      servico.reconectar({
        codigoSala: dono.codigoSala,
        tokenSessao: dono.tokenSessao,
        dispositivoId: 'disp-ana',
      }),
    ).toThrow(expect.objectContaining({ codigo: 'SALA_NAO_ENCONTRADA' }));
  });

  it('devePassarODonoAdianteEDevolverAoCriadorQuandoEleVolta', () => {
    const dono = criarSala();
    const bia = entrar(dono, 'Bia');
    servico.sair(ator(dono));
    expect(salaDe(bia)?.participantes).toEqual([
      expect.objectContaining({ apelido: 'Bia', ehAnfitriao: true }),
    ]);

    const anaDeVolta = servico.entrarSala({
      codigoSala: dono.codigoSala,
      apelido: 'Ana',
      dispositivoId: 'disp-ana',
    });
    const participantes = salaDe(bia)?.participantes ?? [];
    expect(participantes.find((p) => p.id === anaDeVolta.jogadorId)?.ehAnfitriao).toBe(true);
    expect(participantes.find((p) => p.id === bia.jogadorId)?.ehAnfitriao).toBe(false);
  });
});

describe('ServicoDeSalas — expulsar', () => {
  it('deveBanirOHumanoExpulsoPeloNavegador', () => {
    const dono = criarSala();
    const bia = entrar(dono, 'Bia', 'disp-bia');
    const expulsao = servico.expulsar(ator(dono), bia.jogadorId);
    expect(expulsao).toEqual({ expulsoId: bia.jogadorId, eraHumano: true });
    expect(salaDe(dono)?.participantes.map((p) => p.apelido)).toEqual(['Ana']);
    expect(() => entrar(dono, 'Outro nome', 'disp-bia')).toThrow(
      expect.objectContaining({ codigo: 'BANIDO' }),
    );
  });

  it('deveRemoverBotSemBanir', () => {
    const dono = criarSala();
    servico.adicionarBot(ator(dono));
    const bot = salaDe(dono)?.participantes.find((p) => p.ehBot);
    expect(servico.expulsar(ator(dono), bot?.id ?? '').eraHumano).toBe(false);
    expect(salaDe(dono)?.participantes).toHaveLength(1);
  });

  it('deveDeixarUmBotTerminarARodadaDeQuemFoiExpulsoNoMeioDaPartida', () => {
    const dono = criarSala();
    const bia = entrar(dono, 'Bia');
    servico.adicionarBot(ator(dono));
    servico.iniciarPartida(ator(dono));
    servico.expulsar(ator(dono), bia.jogadorId);

    const durante = partidaDe(dono);
    expect(durante?.jogadores.find((j) => j.id === bia.jogadorId)?.saiAoFimDaRodada).toBe(true);
    expect(salaDe(dono)?.participantes.find((p) => p.id === bia.jogadorId)?.saindo).toBe(true);

    for (let i = 0; i < 20 && partidaDe(dono)?.numeroRodada === 1; i++) {
      humanosJogam([dono]);
      relogio.avancar(ATRASO_BOT_MS + PAUSA_FIM_RODADA_MS);
    }
    const depois = partidaDe(dono);
    expect(depois?.jogadores.some((j) => j.id === bia.jogadorId)).toBe(false);
    expect(salaDe(dono)?.participantes.some((p) => p.id === bia.jogadorId)).toBe(false);
  });
});

describe('ServicoDeSalas — partida', () => {
  it('deveEnviarACadaJogadorApenasASuaVisao', () => {
    const dono = criarSala();
    servico.adicionarBot(ator(dono));
    servico.iniciarPartida(ator(dono));
    const estado = partidaDe(dono);
    expect(estado?.fase).toBe('palpites');
    // Os lugares são sorteados: procura cada um pelo id, não pela posição.
    const ana = estado?.jogadores.find((j) => j.id === dono.jogadorId);
    const bot = estado?.jogadores.find((j) => j.ehBot);
    expect(ana?.apelido).toBe('Ana');
    expect(bot).toBeDefined();
    expect(estado?.idDoPrimeiro).not.toBeNull();
    // Rodada cega: o humano vê a carta do bot, mas não a própria.
    expect(bot?.cartaNaTesta).not.toBeNull();
    expect(ana?.cartaNaTesta).toBeNull();
  });

  it('deveJogarPeloHumanoQuandoOPrazoEstouraEInformarOTempoRestante', () => {
    const dono = criarSala();
    servico.adicionarBot(ator(dono));
    servico.iniciarPartida(ator(dono));

    relogio.avancar(1_000);
    const antes = partidaDe(dono);
    expect(antes?.idDaVez).toBe(dono.jogadorId);
    expect(antes?.prazoDaVezRestanteMs).toBeGreaterThan(0);
    expect(antes?.prazoDaVezRestanteMs).toBeLessThanOrEqual(PRAZO_MS);
    expect(antes?.jogadores[0]?.palpite).toBeNull();

    relogio.avancar(PRAZO_MS);
    expect(partidaDe(dono)?.jogadores[0]?.palpite).not.toBeNull();
  });

  it('deveUsarOPrazoEscolhidoNaSala', () => {
    const dono = servico.criarSala({
      apelido: 'Ana',
      configuracao: { ...CONFIGURACAO_PADRAO, prazoDaVezSegundos: 10 },
      dispositivoId: 'disp-ana',
    });
    servico.adicionarBot(ator(dono));
    servico.iniciarPartida(ator(dono));
    expect(partidaDe(dono)?.prazoDaVezRestanteMs).toBe(10_000);

    relogio.avancar(10_000);
    expect(partidaDe(dono)?.jogadores.find((j) => j.id === dono.jogadorId)?.palpite).not.toBeNull();
  });

  it('naoDeveJogarPeloHumanoQuandoASalaNaoTemLimiteDeTempo', () => {
    const dono = servico.criarSala({
      apelido: 'Ana',
      configuracao: { ...CONFIGURACAO_PADRAO, prazoDaVezSegundos: null },
      dispositivoId: 'disp-ana',
    });
    servico.adicionarBot(ator(dono));
    servico.iniciarPartida(ator(dono));

    relogio.avancar(PRAZO_MS * 10);
    const estado = partidaDe(dono);
    expect(estado?.idDaVez).toBe(dono.jogadorId);
    expect(estado?.prazoDaVezRestanteMs).toBeNull();
    expect(estado?.jogadores.find((j) => j.id === dono.jogadorId)?.palpite).toBeNull();
  });

  it('deveLevarAPartidaAteOFimSoComPrazosEBots', () => {
    const dono = criarSala();
    for (let i = 0; i < 3; i++) servico.adicionarBot(ator(dono));
    servico.iniciarPartida(ator(dono));

    for (let passo = 0; passo < 2_000; passo++) {
      if (partidaDe(dono)?.fase === 'encerrada') break;
      relogio.avancar(PRAZO_MS);
    }
    const final = partidaDe(dono);
    expect(final?.fase).toBe('encerrada');
    expect(final?.vencedores.length).toBeGreaterThanOrEqual(1);
    expect(salaDe(dono)?.emPartida).toBe(false);
  });

  it('deveDeixarEntrarNoMeioESentarNaProximaRodadaComAMaiorVida', () => {
    const dono = criarSala();
    servico.adicionarBot(ator(dono));
    servico.adicionarBot(ator(dono));
    servico.iniciarPartida(ator(dono));

    const carla = entrar(dono, 'Carla');
    expect(salaDe(carla)?.participantes.find((p) => p.id === carla.jogadorId)).toEqual(
      expect.objectContaining({ aguardandoProximaRodada: true }),
    );
    expect(partidaDe(carla)?.minhaMao).toEqual([]);
    expect(partidaDe(carla)?.jogadores.some((j) => j.id === carla.jogadorId)).toBe(false);

    for (let i = 0; i < 20 && partidaDe(dono)?.numeroRodada === 1; i++) {
      humanosJogam([dono]);
      relogio.avancar(ATRASO_BOT_MS + PAUSA_FIM_RODADA_MS);
    }
    const estado = partidaDe(carla);
    const vidasDosOutros = estado?.jogadores
      .filter((j) => j.id !== carla.jogadorId && !j.eliminado)
      .map((j) => j.vidas);
    const carlaNaMesa = estado?.jogadores.find((j) => j.id === carla.jogadorId);
    expect(carlaNaMesa?.vidas).toBe(Math.max(...(vidasDosOutros ?? [])));
    expect(estado?.minhaMao.length).toBe(estado?.cartasPorJogador);
  });

  it('deveReiniciarNaRodada1ComVidasCheiasParaTodos', () => {
    const dono = criarSala();
    servico.adicionarBot(ator(dono));
    servico.iniciarPartida(ator(dono));
    for (let i = 0; i < 6; i++) relogio.avancar(PRAZO_MS);
    servico.reiniciar(ator(dono));

    const estado = partidaDe(dono);
    expect(estado?.numeroRodada).toBe(1);
    expect(estado?.jogadores.every((j) => j.vidas === CONFIGURACAO_PADRAO.vidasIniciais)).toBe(
      true,
    );
  });
});

describe('ServicoDeSalas — pausa por desconexão', () => {
  function mesaComDoisHumanosEUmBot() {
    const dono = criarSala();
    const bia = entrar(dono, 'Bia');
    const carlos = entrar(dono, 'Carlos');
    servico.adicionarBot(ator(dono));
    servico.iniciarPartida(ator(dono));
    return { dono, bia, carlos };
  }

  it('naoDevePausarQuandoAQuedaDuraMenosQueACarencia', () => {
    const { dono, bia } = mesaComDoisHumanosEUmBot();
    servico.desconectar(ator(bia));
    relogio.avancar(CARENCIA_MS - 1);
    servico.reconectar({
      codigoSala: bia.codigoSala,
      tokenSessao: bia.tokenSessao,
      dispositivoId: 'disp-Bia',
    });
    relogio.avancar(CARENCIA_MS);
    expect(partidaDe(dono)?.pausa).toBeNull();
  });

  it('devePausarCongelarAMesaEPerguntarSeEsperamOAusente', () => {
    const { dono, bia, carlos } = mesaComDoisHumanosEUmBot();
    servico.desconectar(ator(bia));
    relogio.avancar(CARENCIA_MS);

    const pausado = partidaDe(dono);
    expect(pausado?.pausa?.votacoes).toEqual([
      expect.objectContaining({
        ausenteId: bia.jogadorId,
        apelido: 'Bia',
        votos: [
          { eleitorId: dono.jogadorId, esperar: null },
          { eleitorId: carlos.jogadorId, esperar: null },
        ],
      }),
    ]);
    expect(pausado?.prazoDaVezEm).toBeNull();

    const fotografia = JSON.stringify(partidaDe(dono)?.jogadores);
    relogio.avancar(10 * PRAZO_MS);
    expect(JSON.stringify(partidaDe(dono)?.jogadores)).toBe(fotografia);
    expect(() => servico.palpitar(ator(dono), 0)).toThrow(
      expect.objectContaining({ codigo: 'JOGO_PAUSADO' }),
    );
  });

  it('deveContinuarEsperandoComUmSimEEliminarQuandoTodosVotamNao', () => {
    const { dono, bia, carlos } = mesaComDoisHumanosEUmBot();
    servico.desconectar(ator(bia));
    relogio.avancar(CARENCIA_MS);

    servico.votarEspera(ator(dono), { ausenteId: bia.jogadorId, esperar: false });
    servico.votarEspera(ator(carlos), { ausenteId: bia.jogadorId, esperar: true });
    expect(partidaDe(dono)?.pausa).not.toBeNull();

    servico.votarEspera(ator(carlos), { ausenteId: bia.jogadorId, esperar: false });
    const retomado = partidaDe(dono);
    expect(retomado?.pausa).toBeNull();
    expect(retomado?.jogadores.find((j) => j.id === bia.jogadorId)?.saiAoFimDaRodada).toBe(true);

    for (let i = 0; i < 30 && partidaDe(dono)?.numeroRodada === 1; i++) {
      humanosJogam([dono, carlos]);
      relogio.avancar(ATRASO_BOT_MS + PAUSA_FIM_RODADA_MS);
    }
    expect(partidaDe(dono)?.jogadores.find((j) => j.id === bia.jogadorId)?.eliminado).toBe(true);
  });

  it('deveRetomarQuandoOAusenteVolta', () => {
    const { dono, bia } = mesaComDoisHumanosEUmBot();
    servico.desconectar(ator(bia));
    relogio.avancar(CARENCIA_MS);
    servico.reconectar({
      codigoSala: bia.codigoSala,
      tokenSessao: bia.tokenSessao,
      dispositivoId: 'disp-Bia',
    });
    expect(partidaDe(dono)?.pausa).toBeNull();
  });

  it('naoDeveAceitarVotoDeQuemNaoEstaJogando', () => {
    const { dono, bia } = mesaComDoisHumanosEUmBot();
    const espectador = entrar(dono, 'Duda');
    servico.desconectar(ator(bia));
    relogio.avancar(CARENCIA_MS);
    expect(() =>
      servico.votarEspera(ator(espectador), { ausenteId: bia.jogadorId, esperar: false }),
    ).toThrow(expect.objectContaining({ codigo: 'SEM_PERMISSAO' }));
  });
});

describe('ServicoDeSalas — saída voluntária', () => {
  it('deveTirarDaSalaAoFimDaRodadaQuemSaiNoMeio', () => {
    const dono = criarSala();
    const bia = entrar(dono, 'Bia');
    servico.iniciarPartida(ator(dono));
    servico.sair(ator(bia));

    expect(partidaDe(dono)?.jogadores.find((j) => j.apelido === 'Bia')?.saiAoFimDaRodada).toBe(
      true,
    );
    expect(() =>
      servico.reconectar({
        codigoSala: dono.codigoSala,
        tokenSessao: bia.tokenSessao,
        dispositivoId: 'disp-Bia',
      }),
    ).toThrow();
  });
});

describe('ServicoDeSalas — pausa pelo dono', () => {
  function mesaComBot() {
    const dono = criarSala();
    const bia = entrar(dono, 'Bia');
    servico.adicionarBot(ator(dono));
    servico.iniciarPartida(ator(dono));
    return { dono, bia };
  }

  it('deveCongelarAMesaAteODonoRetomar', () => {
    const { dono } = mesaComBot();
    servico.pausar(ator(dono));
    const pausado = partidaDe(dono);
    expect(pausado?.pausa).toEqual({ votacoes: [], pausadaPeloDono: true, lendoRegras: null });
    expect(pausado?.prazoDaVezEm).toBeNull();

    const fotografia = JSON.stringify(partidaDe(dono)?.jogadores);
    relogio.avancar(10 * PRAZO_MS);
    expect(JSON.stringify(partidaDe(dono)?.jogadores)).toBe(fotografia);

    servico.retomar(ator(dono));
    expect(partidaDe(dono)?.pausa).toBeNull();
    // Retomada, a mesa volta a andar: o bot joga ou o prazo do humano estoura e o servidor joga.
    relogio.avancar(PRAZO_MS + ATRASO_BOT_MS);
    expect(JSON.stringify(partidaDe(dono)?.jogadores)).not.toBe(fotografia);
  });

  it('deveRecusarJogadasEnquantoPausada', () => {
    const { dono, bia } = mesaComBot();
    servico.pausar(ator(dono));
    const daVez = [dono, bia].find((h) => partidaDe(h)?.idDaVez === h.jogadorId);
    if (daVez) {
      expect(() => servico.palpitar(ator(daVez), 0)).toThrow(
        expect.objectContaining({ codigo: 'JOGO_PAUSADO' }),
      );
    }
  });

  it('deveDeixarSoODonoPausarERetomar', () => {
    const { dono, bia } = mesaComBot();
    const sem = expect.objectContaining({ codigo: 'SEM_PERMISSAO' });
    expect(() => servico.pausar(ator(bia))).toThrow(sem);
    servico.pausar(ator(dono));
    expect(() => servico.retomar(ator(bia))).toThrow(sem);
  });

  it('naoDevePausarForaDePartida', () => {
    const dono = criarSala();
    expect(() => servico.pausar(ator(dono))).toThrow(
      expect.objectContaining({ codigo: 'ENTRADA_INVALIDA' }),
    );
  });

  it('deveDesfazerAPausaAoReiniciar', () => {
    const { dono } = mesaComBot();
    servico.pausar(ator(dono));
    servico.reiniciar(ator(dono));
    expect(partidaDe(dono)?.pausa).toBeNull();
  });
});

describe('ServicoDeSalas — pausa para ler as regras', () => {
  const LIMITE_MS = LIMITES.maxLeituraDasRegrasSegundos * 1000;
  const invalida = expect.objectContaining({ codigo: 'ENTRADA_INVALIDA' });

  function mesaComBot() {
    const dono = criarSala();
    const bia = entrar(dono, 'Bia');
    servico.adicionarBot(ator(dono));
    servico.iniciarPartida(ator(dono));
    return { dono, bia };
  }

  it('deveCongelarAMesaEAvisarTodosDeQuemEstaLendo', () => {
    const { dono, bia } = mesaComBot();
    servico.lerRegras(ator(bia));
    const visto = partidaDe(dono);
    expect(visto?.pausa?.lendoRegras).toEqual({ jogadorId: bia.jogadorId, restanteMs: LIMITE_MS });
    expect(visto?.prazoDaVezEm).toBeNull();

    const fotografia = JSON.stringify(partidaDe(dono)?.jogadores);
    relogio.avancar(LIMITE_MS - 1);
    expect(JSON.stringify(partidaDe(dono)?.jogadores)).toBe(fotografia);

    servico.pararDeLerRegras(ator(bia));
    expect(partidaDe(dono)?.pausa).toBeNull();
  });

  it('deveRetomarSozinhaQuandoOTempoAcaba', () => {
    const { dono, bia } = mesaComBot();
    servico.lerRegras(ator(bia));
    relogio.avancar(LIMITE_MS);
    expect(partidaDe(dono)?.pausa).toBeNull();
    // Fechar o diálogo depois do tempo esgotado não é erro.
    expect(() => servico.pararDeLerRegras(ator(bia))).not.toThrow();
  });

  it('devePermitirUmaLeituraPorJogadorPorPartida', () => {
    const { dono, bia } = mesaComBot();
    servico.lerRegras(ator(bia));
    servico.pararDeLerRegras(ator(bia));
    expect(() => servico.lerRegras(ator(bia))).toThrow(invalida);

    servico.reiniciar(ator(dono));
    expect(() => servico.lerRegras(ator(bia))).not.toThrow();
  });

  it('deveAceitarUmLeitorPorVez', () => {
    const { dono, bia } = mesaComBot();
    servico.lerRegras(ator(bia));
    expect(() => servico.lerRegras(ator(dono))).toThrow(invalida);
  });

  it('deveEncerrarALeituraDeQuemCaiu', () => {
    const { dono, bia } = mesaComBot();
    servico.lerRegras(ator(bia));
    servico.desconectar(ator(bia));
    expect(partidaDe(dono)?.pausa?.lendoRegras ?? null).toBeNull();
  });

  it('naoDevePausarForaDePartida', () => {
    const dono = criarSala();
    expect(() => servico.lerRegras(ator(dono))).toThrow(invalida);
  });
});

describe('ServicoDeSalas — reações', () => {
  function mesaComDoisHumanos() {
    const dono = criarSala();
    const bia = entrar(dono, 'Bia');
    servico.adicionarBot(ator(dono));
    servico.iniciarPartida(ator(dono));
    return { dono, bia };
  }

  it('deveTransmitirReacaoValidaAosHumanosDaSala', () => {
    const { dono, bia } = mesaComDoisHumanos();
    servico.reagir(ator(bia), '🔥');
    expect(notificador.reacoes).toHaveLength(1);
    const envio = notificador.reacoes[0];
    expect(envio?.reacao).toMatchObject({ jogadorId: bia.jogadorId, reacao: '🔥' });
    expect([...(envio?.destinatarios ?? [])].sort()).toEqual(
      [dono.jogadorId, bia.jogadorId].sort(),
    );
  });

  it('deveLimitarReacoesEmSequenciaDoMesmoJogador', () => {
    const { dono, bia } = mesaComDoisHumanos();
    servico.reagir(ator(dono), '😂');
    expect(() => servico.reagir(ator(dono), '😂')).toThrow(
      expect.objectContaining({ codigo: 'MUITAS_REQUISICOES' }),
    );
    // O limite é por jogador: outra pessoa reage normalmente.
    servico.reagir(ator(bia), '👏');
    relogio.avancar(1_500);
    servico.reagir(ator(dono), '🙏');
    expect(notificador.reacoes).toHaveLength(3);
  });

  it('naoDevePermitirReacaoForaDePartida', () => {
    const dono = criarSala();
    expect(() => servico.reagir(ator(dono), '😂')).toThrow(
      expect.objectContaining({ codigo: 'JOGADA_INVALIDA' }),
    );
  });
});
