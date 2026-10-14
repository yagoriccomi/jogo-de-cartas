import type { SessaoJogador } from '@fodinha/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ABANDONO_MS,
  ATRASO_BOT_MS,
  CARENCIA_MS,
  PAUSA_FIM_RODADA_MS,
  PRAZO_MS,
  ator,
  montarCenario,
  type Cenario,
} from '../apoio';

let c: Cenario;

beforeEach(() => {
  c = montarCenario();
});

const semPermissao = expect.objectContaining({ codigo: 'SEM_PERMISSAO' });

function donoDaSala(observador: SessaoJogador): string | undefined {
  return c.salaDe(observador)?.participantes.find((p) => p.ehAnfitriao)?.id;
}

/** Joga (humanos e bots) até a rodada em curso terminar, parando no intervalo entre rodadas. */
function jogarAteFimDeRodada(humanos: readonly SessaoJogador[], observador: SessaoJogador): void {
  for (let i = 0; i < 60 && c.partidaDe(observador)?.fase !== 'fim_de_rodada'; i++) {
    c.humanosJogam(humanos);
    c.relogio.avancar(ATRASO_BOT_MS);
  }
  expect(c.partidaDe(observador)?.fase).toBe('fim_de_rodada');
}

describe('Regressão 1 — dono e segunda aba do criador', () => {
  it('naoDeveRoubarOPostoDeDonoQuandoOCriadorAindaEstaPresente', () => {
    const ana = c.criarSala();
    const segundaAba = c.entrar(ana, 'Ana (aba 2)', 'disp-ana');

    expect(donoDaSala(ana)).toBe(ana.jogadorId);
    expect(donoDaSala(segundaAba)).toBe(ana.jogadorId);
  });

  it('deveDevolverOPostoAoCriadorQueSaiuEVoltaPeloMesmoNavegador', () => {
    const ana = c.criarSala();
    const bia = c.entrar(ana, 'Bia');
    c.servico.sair(ator(ana));
    expect(donoDaSala(bia)).toBe(bia.jogadorId);

    const anaDeVolta = c.entrar(bia, 'Ana', 'disp-ana');
    expect(donoDaSala(bia)).toBe(anaDeVolta.jogadorId);

    // Com o criador de volta, outra aba dele não mexe mais no posto.
    c.entrar(bia, 'Ana (aba 2)', 'disp-ana');
    expect(donoDaSala(bia)).toBe(anaDeVolta.jogadorId);
  });

  it('deveDevolverOPostoAoCriadorQueSaiuNoMeioDaPartidaEVolta', () => {
    const ana = c.criarSala();
    const bia = c.entrar(ana, 'Bia');
    c.servico.adicionarBot(ator(ana));
    c.servico.iniciarPartida(ator(ana));
    c.servico.sair(ator(ana));
    expect(donoDaSala(bia)).toBe(bia.jogadorId);

    const anaDeVolta = c.entrar(bia, 'Ana', 'disp-ana');
    expect(donoDaSala(bia)).toBe(anaDeVolta.jogadorId);
  });
});

describe('Regressão 2 — carência para quem é sentado já desconectado', () => {
  it('deveDarCarenciaEDepoisPausarQuemCaiuNoLobbyEFoiSentadoAoIniciar', () => {
    const ana = c.criarSala();
    const bia = c.entrar(ana, 'Bia');
    c.desconectar(bia);
    c.servico.iniciarPartida(ator(ana));

    expect(c.partidaDe(ana)?.pausa).toBeNull();
    c.relogio.avancar(CARENCIA_MS - 1);
    expect(c.partidaDe(ana)?.pausa).toBeNull();

    c.relogio.avancar(1);
    expect(c.partidaDe(ana)?.pausa?.votacoes).toEqual([
      expect.objectContaining({
        ausenteId: bia.jogadorId,
        votos: [{ eleitorId: ana.jogadorId, esperar: null }],
      }),
    ]);
  });

  it('deveDarCarenciaDeNovoAoReiniciarComUmHumanoAindaDesconectado', () => {
    const ana = c.criarSala();
    const bia = c.entrar(ana, 'Bia');
    c.servico.adicionarBot(ator(ana));
    c.servico.iniciarPartida(ator(ana));
    c.desconectar(bia);
    c.relogio.avancar(CARENCIA_MS);
    expect(c.partidaDe(ana)?.pausa).not.toBeNull();

    c.servico.reiniciar(ator(ana));
    expect(c.partidaDe(ana)?.numeroRodada).toBe(1);
    expect(c.partidaDe(ana)?.pausa).toBeNull();

    c.relogio.avancar(CARENCIA_MS - 1);
    expect(c.partidaDe(ana)?.pausa).toBeNull();
    c.relogio.avancar(1);
    expect(c.partidaDe(ana)?.pausa?.votacoes.map((v) => v.ausenteId)).toEqual([bia.jogadorId]);
  });

  it('deveDarCarenciaAoEntranteQueCaiuEsperandoEFoiSentadoNaViradaDeRodada', () => {
    const ana = c.criarSala();
    c.servico.adicionarBot(ator(ana));
    c.servico.iniciarPartida(ator(ana));
    const carla = c.entrar(ana, 'Carla');
    c.desconectar(carla);

    // Esperando sentar, ela não é esperada por ninguém: não há carência nem votação.
    c.relogio.avancar(CARENCIA_MS);
    expect(c.partidaDe(ana)?.pausa).toBeNull();

    c.jogarAteNovaRodada([ana], ana);
    expect(c.partidaDe(ana)?.numeroRodada).toBe(2);
    expect(c.partidaDe(ana)?.jogadores.some((j) => j.id === carla.jogadorId)).toBe(true);
    expect(c.partidaDe(ana)?.pausa).toBeNull();

    c.relogio.avancar(CARENCIA_MS);
    expect(c.partidaDe(ana)?.pausa?.votacoes.map((v) => v.ausenteId)).toEqual([carla.jogadorId]);
  });
});

describe('Regressão 3 — votação sem eleitores', () => {
  function mesaComDoisHumanos() {
    const ana = c.criarSala();
    const bia = c.entrar(ana, 'Bia');
    c.servico.iniciarPartida(ator(ana));
    return { ana, bia };
  }

  it('deveResolverQuandoTodosQueJogamSaemEHaEspectadorConectado', () => {
    const { ana, bia } = mesaComDoisHumanos();
    const carla = c.entrar(ana, 'Carla');
    c.desconectar(ana);
    c.desconectar(bia);
    c.relogio.avancar(CARENCIA_MS);

    const estado = c.partidaDe(carla);
    expect(estado?.pausa).toBeNull();
    expect(estado?.jogadores.map((j) => j.saiAoFimDaRodada)).toEqual([true, true]);
  });

  it('deveSeguirOJogoAteOFimSemFicarPausadaParaSempreQuandoTodosSaem', () => {
    const { ana, bia } = mesaComDoisHumanos();
    const carla = c.entrar(ana, 'Carla');
    c.desconectar(ana);
    c.desconectar(bia);
    c.relogio.avancar(CARENCIA_MS);

    for (let i = 0; i < 40 && c.partidaDe(carla)?.fase !== 'encerrada'; i++) {
      c.relogio.avancar(PAUSA_FIM_RODADA_MS);
    }
    // Regra decidida: se todos que restam saem na mesma virada, o vencedor sai de entre todos.
    const final = c.partidaDe(carla);
    expect(final?.fase).toBe('encerrada');
    expect(final?.vencedores.length).toBeGreaterThanOrEqual(1);
    expect(final?.vencedores.every((id) => [ana.jogadorId, bia.jogadorId].includes(id))).toBe(true);
  });

  it('deveContinuarPausadaQuandoNinguemEstaConectado', () => {
    const { ana, bia } = mesaComDoisHumanos();
    c.desconectar(ana);
    c.desconectar(bia);
    c.relogio.avancar(CARENCIA_MS);

    expect(c.partidaDe(ana)?.pausa?.votacoes).toHaveLength(2);
    c.relogio.avancar(ABANDONO_MS / 2);
    expect(c.partidaDe(ana)?.pausa?.votacoes).toHaveLength(2);
    expect(c.partidaDe(ana)?.jogadores.some((j) => j.saiAoFimDaRodada)).toBe(false);
  });
});

describe('Regressão 4 — eleitor que pisca a rede', () => {
  function mesaComTresHumanosEUmBot() {
    const ana = c.criarSala();
    const bia = c.entrar(ana, 'Bia');
    const carlos = c.entrar(ana, 'Carlos');
    c.servico.adicionarBot(ator(ana));
    c.servico.iniciarPartida(ator(ana));
    return { ana, bia, carlos };
  }

  function abrirVotacaoDaBiaEVotarNaoComAna() {
    const mesa = mesaComTresHumanosEUmBot();
    c.desconectar(mesa.bia);
    c.relogio.avancar(CARENCIA_MS);
    c.desconectar(mesa.carlos);
    c.servico.votarEspera(ator(mesa.ana), { ausenteId: mesa.bia.jogadorId, esperar: false });
    return mesa;
  }

  it('naoDeveEncerrarAVotacaoDeOutroAusenteSoPorqueUmEleitorSemVotoCaiu', () => {
    const { ana, bia } = abrirVotacaoDaBiaEVotarNaoComAna();

    const estado = c.partidaDe(ana);
    expect(estado?.pausa?.votacoes.map((v) => v.ausenteId)).toEqual([bia.jogadorId]);
    expect(estado?.jogadores.find((j) => j.id === bia.jogadorId)?.saiAoFimDaRodada).toBe(false);
  });

  it('naoDeveResolverSeOEleitorVoltaAntesDaCarenciaEDeveAguardarOVotoDele', () => {
    const { ana, bia, carlos } = abrirVotacaoDaBiaEVotarNaoComAna();
    c.relogio.avancar(CARENCIA_MS - 1);
    c.reconectar(carlos, 'disp-carlos');
    c.relogio.avancar(CARENCIA_MS);

    expect(c.partidaDe(ana)?.pausa?.votacoes.map((v) => v.ausenteId)).toEqual([bia.jogadorId]);

    c.servico.votarEspera(ator(carlos), { ausenteId: bia.jogadorId, esperar: false });
    const depois = c.partidaDe(ana);
    expect(depois?.pausa).toBeNull();
    expect(depois?.jogadores.find((j) => j.id === bia.jogadorId)?.saiAoFimDaRodada).toBe(true);
  });

  it('deveMudarOEleitoradoSoQuandoACarenciaDoEleitorVence', () => {
    const { ana, bia, carlos } = abrirVotacaoDaBiaEVotarNaoComAna();
    c.relogio.avancar(CARENCIA_MS);

    const estado = c.partidaDe(ana);
    expect(estado?.jogadores.find((j) => j.id === bia.jogadorId)?.saiAoFimDaRodada).toBe(true);
    // Agora o ausente é o Carlos, e só a Ana decide.
    expect(estado?.pausa?.votacoes).toEqual([
      expect.objectContaining({
        ausenteId: carlos.jogadorId,
        votos: [{ eleitorId: ana.jogadorId, esperar: null }],
      }),
    ]);
  });
});

describe('Regressão 5 — promoção de dono', () => {
  it('devePassarOPostoParaUmHumanoConectadoEmVezDoMaisAntigoDesconectado', () => {
    const ana = c.criarSala();
    const bia = c.entrar(ana, 'Bia');
    const carlos = c.entrar(ana, 'Carlos');
    c.desconectar(bia);
    c.servico.sair(ator(ana));

    expect(donoDaSala(carlos)).toBe(carlos.jogadorId);
  });

  it('deveUsarODesconectadoQuandoNaoHaNingumConectadoParaAssumir', () => {
    const ana = c.criarSala();
    const bia = c.entrar(ana, 'Bia');
    c.desconectar(bia);
    c.servico.sair(ator(ana));

    expect(donoDaSala(bia)).toBe(bia.jogadorId);
  });
});

describe('Regressão 6 — limpeza de sala ao sair deixando só desconectados', () => {
  it('deveRemoverASalaDepoisDoTempoDeAbandono', () => {
    const ana = c.criarSala();
    const bia = c.entrar(ana, 'Bia');
    c.desconectar(bia);
    c.servico.sair(ator(ana));

    c.relogio.avancar(ABANDONO_MS);
    expect(() => c.reconectar(bia, 'disp-bia')).toThrow(
      expect.objectContaining({ codigo: 'SALA_NAO_ENCONTRADA' }),
    );
  });

  it('naoDeveRemoverAntesDoTempoNemDepoisQueAlguemReconecta', () => {
    const ana = c.criarSala();
    const bia = c.entrar(ana, 'Bia');
    c.desconectar(bia);
    c.servico.sair(ator(ana));

    c.relogio.avancar(ABANDONO_MS - 1);
    expect(c.reconectar(bia, 'disp-bia').jogadorId).toBe(bia.jogadorId);

    c.relogio.avancar(ABANDONO_MS * 2);
    expect(c.reconectar(bia, 'disp-bia').jogadorId).toBe(bia.jogadorId);
  });
});

describe('Regressão 7 — iniciar/reiniciar com menos de 2 ativos', () => {
  it('deveFalharAoIniciarSozinhoSemAlterarASala', () => {
    const ana = c.criarSala();
    expect(() => c.servico.iniciarPartida(ator(ana))).toThrow(
      expect.objectContaining({ codigo: 'ENTRADA_INVALIDA' }),
    );
    expect(c.salaDe(ana)?.emPartida).toBe(false);
    expect(c.salaDe(ana)?.participantes).toHaveLength(1);
    expect(c.partidaDe(ana)).toBeUndefined();
  });

  it('deveFalharAoReiniciarSemAlterarQuemEstaSaindoNemAPartida', () => {
    const ana = c.criarSala();
    const bia = c.entrar(ana, 'Bia');
    c.servico.iniciarPartida(ator(ana));
    c.servico.sair(ator(bia));
    const antes = c.partidaDe(ana);

    expect(() => c.servico.reiniciar(ator(ana))).toThrow(
      expect.objectContaining({ codigo: 'ENTRADA_INVALIDA' }),
    );

    const depois = c.partidaDe(ana);
    expect(depois?.numeroRodada).toBe(antes?.numeroRodada);
    expect(depois?.jogadores.find((j) => j.id === bia.jogadorId)?.saiAoFimDaRodada).toBe(true);
    expect(c.salaDe(ana)?.participantes.find((p) => p.id === bia.jogadorId)?.saindo).toBe(true);
    expect(c.salaDe(ana)?.emPartida).toBe(true);

    // A partida segue normalmente: a Bia some ao fim da rodada e a Ana vence.
    c.jogarAteNovaRodada([ana], ana);
    const final = c.partidaDe(ana);
    expect(final?.fase).toBe('encerrada');
    expect(final?.vencedores).toEqual([ana.jogadorId]);
  });

  it('deveContinuarImpedindoQuemNaoEhDonoDeReiniciar', () => {
    const ana = c.criarSala();
    const bia = c.entrar(ana, 'Bia');
    c.servico.iniciarPartida(ator(ana));
    expect(() => c.servico.reiniciar(ator(bia))).toThrow(semPermissao);
  });
});

describe('proximaRodada publicada pelo condutor', () => {
  function mesaComUmHumanoETresBots() {
    const ana = c.criarSala();
    for (let i = 0; i < 3; i++) c.servico.adicionarBot(ator(ana));
    c.servico.iniciarPartida(ator(ana));
    return ana;
  }

  it('deveEstarAusenteForaDoFimDeRodada', () => {
    const ana = mesaComUmHumanoETresBots();
    expect(c.partidaDe(ana)?.fase).toBe('palpites');
    expect(c.partidaDe(ana)?.proximaRodada).toBeNull();
  });

  it('deveInformarOQueVemEACorrerOTempoAteADistribuicao', () => {
    const ana = mesaComUmHumanoETresBots();
    jogarAteFimDeRodada([ana], ana);

    const previsao = c.partidaDe(ana)?.proximaRodada;
    expect(previsao?.comecaEmMs).toBeGreaterThan(0);
    expect(previsao?.comecaEmMs).toBeLessThanOrEqual(PAUSA_FIM_RODADA_MS);

    c.relogio.avancar(1_000);
    c.servico.republicar(ana.codigoSala);
    expect(c.partidaDe(ana)?.proximaRodada?.comecaEmMs).toBe((previsao?.comecaEmMs ?? 0) - 1_000);

    c.relogio.avancar(PAUSA_FIM_RODADA_MS);
    const real = c.partidaDe(ana);
    expect(real?.fase).toBe('palpites');
    expect(real?.numeroRodada).toBe(2);
    expect(real?.cartasPorJogador).toBe(previsao?.cartasPorJogador);
    expect(real?.idDoPrimeiro).toBe(previsao?.idDoPrimeiro);
    expect(real?.proximaRodada).toBeNull();
  });

  it('deveConsiderarOEntranteQueSentaNaViradaDeRodada', () => {
    const ana = mesaComUmHumanoETresBots();
    jogarAteFimDeRodada([ana], ana);
    const carla = c.entrar(ana, 'Carla');

    const previsao = c.partidaDe(ana)?.proximaRodada;
    expect(previsao).not.toBeNull();
    expect(c.partidaDe(carla)?.proximaRodada).toEqual(previsao);

    c.relogio.avancar(PAUSA_FIM_RODADA_MS);
    const real = c.partidaDe(carla);
    expect(real?.jogadores.some((j) => j.id === carla.jogadorId)).toBe(true);
    expect(real?.cartasPorJogador).toBe(previsao?.cartasPorJogador);
    expect(real?.idDoPrimeiro).toBe(previsao?.idDoPrimeiro);
  });

  it('deveConsiderarASaidaDoPeNoIntervaloEntreRodadas', () => {
    const ana = mesaComUmHumanoETresBots();
    jogarAteFimDeRodada([ana], ana);

    // O pé é sorteado pela semente fixa; se fosse a própria Ana, o teste avisaria em vez de passar em falso.
    const peId = c.partidaDe(ana)?.idDoPe as string;
    expect(peId).not.toBe(ana.jogadorId);
    c.servico.expulsar(ator(ana), peId);

    const previsao = c.partidaDe(ana)?.proximaRodada;
    expect(previsao).not.toBeNull();
    expect(previsao?.idDoPrimeiro).not.toBe(peId);

    c.relogio.avancar(PAUSA_FIM_RODADA_MS);
    const real = c.partidaDe(ana);
    expect(real?.jogadores.some((j) => j.id === peId)).toBe(false);
    expect(real?.cartasPorJogador).toBe(previsao?.cartasPorJogador);
    expect(real?.idDoPrimeiro).toBe(previsao?.idDoPrimeiro);
  });

  it('deveFicarSemContagemQuandoAMesaEstaPausadaNoIntervalo', () => {
    c = montarCenario({ carenciaDeDesconexaoMs: 1_000 });
    const ana = c.criarSala();
    const bia = c.entrar(ana, 'Bia');
    c.servico.adicionarBot(ator(ana));
    c.servico.iniciarPartida(ator(ana));
    jogarAteFimDeRodada([ana, bia], ana);
    expect(c.partidaDe(ana)?.proximaRodada?.comecaEmMs).toBeGreaterThan(0);

    c.desconectar(bia);
    c.relogio.avancar(1_000);
    const pausado = c.partidaDe(ana);
    expect(pausado?.pausa).not.toBeNull();
    expect(pausado?.proximaRodada?.comecaEmMs).toBeNull();
    expect(pausado?.proximaRodada?.cartasPorJogador).toBeGreaterThan(0);

    c.relogio.avancar(10 * PRAZO_MS);
    expect(c.partidaDe(ana)?.numeroRodada).toBe(1);
    expect(c.partidaDe(ana)?.fase).toBe('fim_de_rodada');

    c.reconectar(bia, 'disp-bia');
    expect(c.partidaDe(ana)?.proximaRodada?.comecaEmMs).toBeGreaterThan(0);
    c.relogio.avancar(PAUSA_FIM_RODADA_MS);
    expect(c.partidaDe(ana)?.numeroRodada).toBe(2);
  });
});
