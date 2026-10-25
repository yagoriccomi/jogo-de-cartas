import { CONFIGURACAO_PADRAO, type EstadoPartidaVisivel } from '@fodinha/shared';
import { describe, expect, it } from 'vitest';
import type { ProximoPasso } from '../../src/domain/agenda';
import { projetarMesa, projetarSala, type InstantesDaMesa } from '../../src/domain/projecao';
import { Sala, type Participante } from '../../src/domain/sala';
import { geradorComSemente, jogarRodadaAteOFim } from '../apoio';

/** Projeção pura: a sala e os instantes entram como dado, sem serviço, condutor nem notificador. */

const SEM_AGENDA: InstantesDaMesa = { agora: 0, passo: null };

function participante(id: string, ehBot = false): Participante {
  return {
    id,
    apelido: `Apelido de ${id}`,
    ehBot,
    perfilDoBot: null,
    conectado: true,
    tokenSessao: ehBot ? null : `token-${id}`,
    dispositivoId: ehBot ? null : `disp-${id}`,
    contaId: null,
  };
}

/** Ana (dona), Bia, Carlos e um bot, na rodada 1 (cega, de 1 carta). */
function mesa(configuracao = CONFIGURACAO_PADRAO): Sala {
  const sala = new Sala('SALA', participante('ana'), configuracao);
  sala.adicionarHumano(participante('bia'));
  sala.adicionarHumano(participante('carlos'));
  sala.adicionarBot('ana', participante('bot', true));
  sala.iniciarPartida('ana', geradorComSemente(7));
  return sala;
}

function estadoDe(
  sala: Sala,
  destinatarioId: string,
  instantes = SEM_AGENDA,
): EstadoPartidaVisivel | undefined {
  return projetarMesa(sala, instantes).partidas.find((p) => p.destinatarioId === destinatarioId)
    ?.estado;
}

function estadoExigido(sala: Sala, destinatarioId: string, instantes = SEM_AGENDA) {
  const estado = estadoDe(sala, destinatarioId, instantes);
  if (!estado) throw new Error(`${destinatarioId} não recebeu estado`);
  return estado;
}

/** Carlos cai, a mesa vota por não esperar e ele está eliminado quando a rodada 2 é distribuída. */
function mesaComCarlosEliminado(): Sala {
  const sala = mesa();
  sala.marcarConexao('carlos', false);
  sala.abrirVotacao('carlos', 0);
  sala.votar('ana', 'carlos', false);
  sala.votar('bia', 'carlos', false);
  const partida = sala.partida;
  if (!partida) throw new Error('sem partida');
  jogarRodadaAteOFim(partida);
  partida.iniciarProximaRodada();
  return sala;
}

describe('Projeção da mesa — destinatários', () => {
  it('deveEntregarSoAosHumanosQuePertencemASala', () => {
    const projecao = projetarMesa(mesa(), SEM_AGENDA);
    expect(projecao.destinatarios).toEqual(['ana', 'bia', 'carlos']);
    expect(projecao.partidas.map((p) => p.destinatarioId)).toEqual(['ana', 'bia', 'carlos']);
  });

  it('naoDeveEntregarNadaAQuemEstaSaindoMesmoComOAssentoGuardado', () => {
    const sala = mesa();
    sala.sair('bia');

    const projecao = projetarMesa(sala, SEM_AGENDA);
    expect(projecao.destinatarios).toEqual(['ana', 'carlos']);
    expect(projecao.partidas.some((p) => p.destinatarioId === 'bia')).toBe(false);
    // Os outros ainda a veem na sala, marcada como saindo, enquanto um bot termina a rodada.
    expect(projecao.sala.participantes.find((p) => p.id === 'bia')?.saindo).toBe(true);
  });

  it('naoDeveMandarEstadoDePartidaNoLobby', () => {
    const sala = new Sala('SALA', participante('ana'), CONFIGURACAO_PADRAO);
    sala.adicionarHumano(participante('bia'));

    const projecao = projetarMesa(sala, SEM_AGENDA);
    expect(projecao.destinatarios).toEqual(['ana', 'bia']);
    expect(projecao.partidas).toEqual([]);
    expect(projecao.sala).toEqual(projetarSala(sala));
    expect(projecao.sala.participantes.find((p) => p.id === 'ana')?.ehAnfitriao).toBe(true);
  });
});

describe('Projeção da mesa — cartas', () => {
  it('naoDeveMostrarAoVivoAMaoDeNinguemEmNenhumaRodadaMesmoComMortosVeemCartas', () => {
    const sala = mesa({ ...CONFIGURACAO_PADRAO, mortosVeemCartas: true });
    const partida = sala.partida;
    if (!partida) throw new Error('sem partida');
    for (let rodada = 0; rodada < 4 && partida.faseAtual !== 'encerrada'; rodada++) {
      for (const { destinatarioId, estado } of projetarMesa(sala, SEM_AGENDA).partidas) {
        if (!partida.estaJogando(destinatarioId)) continue;
        expect(estado.jogadores.every((j) => j.maoRevelada === null)).toBe(true);
      }
      jogarRodadaAteOFim(partida);
      if (partida.faseAtual === 'fim_de_rodada') partida.iniciarProximaRodada();
    }
  });

  it('deveMostrarNaRodadaCegaACartaNaTestaDosOutrosENuncaAPropria', () => {
    const sala = mesa();
    const estado = estadoExigido(sala, 'ana');

    expect(estado.rodadaCega).toBe(true);
    expect(estado.minhaMao).toEqual([{ id: expect.any(String), oculta: true }]);
    for (const jogador of estado.jogadores) {
      if (jogador.id === 'ana') expect(jogador.cartaNaTesta).toBeNull();
      else expect(jogador.cartaNaTesta).not.toBeNull();
    }
  });

  it('deveRevelarAoEliminadoAMaoDosOutrosSoComAOpcaoLigada', () => {
    const sala = mesaComCarlosEliminado();
    const maosVistasPeloCarlos = () =>
      estadoExigido(sala, 'carlos')
        .jogadores.filter((j) => j.id !== 'carlos')
        .map((j) => j.maoRevelada);
    expect(estadoExigido(sala, 'carlos').jogadores.find((j) => j.id === 'carlos')?.eliminado).toBe(
      true,
    );
    expect(maosVistasPeloCarlos().every((mao) => mao === null)).toBe(true);

    sala.definirMortosVeemCartas('ana', true);

    expect(maosVistasPeloCarlos().every((mao) => mao !== null && mao.length > 0)).toBe(true);
    for (const vivo of ['ana', 'bia']) {
      expect(estadoExigido(sala, vivo).jogadores.every((j) => j.maoRevelada === null)).toBe(true);
    }
  });

  it('deveTratarQuemEntrouNoMeioComoEspectadorAteSentar', () => {
    const sala = mesa();
    sala.adicionarHumano(participante('dani'));

    const projecao = projetarMesa(sala, SEM_AGENDA);
    const estado = estadoExigido(sala, 'dani');
    expect(projecao.destinatarios).toContain('dani');
    expect(projecao.sala.participantes.find((p) => p.id === 'dani')?.aguardandoProximaRodada).toBe(
      true,
    );
    expect(estado.minhaMao).toEqual([]);
    expect(estado.jogadores.some((j) => j.id === 'dani')).toBe(false);
    // Espectador não é ninguém da mesa: vê a carta na testa de todos, como os de fora.
    expect(estado.jogadores.every((j) => j.cartaNaTesta !== null)).toBe(true);
  });

  it('deveCompletarCadaJogadorComOsDadosDaSala', () => {
    const sala = mesa();
    sala.marcarConexao('carlos', false);

    const jogadores = estadoExigido(sala, 'ana').jogadores;
    expect(jogadores.find((j) => j.id === 'bot')).toMatchObject({
      apelido: 'Apelido de bot',
      ehBot: true,
      conectado: true,
    });
    expect(jogadores.find((j) => j.id === 'carlos')).toMatchObject({
      ehBot: false,
      conectado: false,
    });
  });
});

describe('Projeção da mesa — instantes da agenda', () => {
  const prazo = (em: number): ProximoPasso => ({ tipo: 'prazoDaVez', jogadorId: 'ana', em });

  it('deveMostrarOPrazoDaVezEORestanteNoInstanteDoEnvio', () => {
    const estado = estadoExigido(mesa(), 'bia', { agora: 12_000, passo: prazo(30_000) });
    expect(estado.prazoDaVezEm).toBe(30_000);
    expect(estado.prazoDaVezRestanteMs).toBe(18_000);
  });

  it('naoDeveDarRestanteNegativoNemPrazoQuandoQuemJogaEBot', () => {
    const atrasado = estadoExigido(mesa(), 'bia', { agora: 31_000, passo: prazo(30_000) });
    expect(atrasado.prazoDaVezRestanteMs).toBe(0);

    const doBot: ProximoPasso = { tipo: 'jogadaDoBot', jogadorId: 'bot', em: 900 };
    const estado = estadoExigido(mesa(), 'bia', { agora: 0, passo: doBot });
    expect(estado.prazoDaVezEm).toBeNull();
    expect(estado.prazoDaVezRestanteMs).toBeNull();
  });

  it('deveContarATempoParaAProximaRodadaNoFimDaRodada', () => {
    const sala = mesa();
    const partida = sala.partida;
    if (!partida) throw new Error('sem partida');
    jogarRodadaAteOFim(partida);
    const passo: ProximoPasso = { tipo: 'proximaRodada', em: 10_000 };

    const estado = estadoExigido(sala, 'ana', { agora: 4_000, passo });
    expect(estado.fase).toBe('fim_de_rodada');
    expect(estado.proximaRodada?.comecaEmMs).toBe(6_000);
    expect(estado.prazoDaVezEm).toBeNull();
  });
});

describe('Projeção da mesa — pausa', () => {
  it('naoDeveMostrarPausaComAMesaCorrendo', () => {
    expect(estadoExigido(mesa(), 'ana').pausa).toBeNull();
  });

  it('deveMostrarAVotacaoDeEsperaComOVotoDeCadaEleitor', () => {
    const sala = mesa();
    sala.marcarConexao('carlos', false);
    sala.abrirVotacao('carlos', 500);
    sala.votar('ana', 'carlos', true);

    expect(estadoExigido(sala, 'bia').pausa).toEqual({
      votacoes: [
        {
          ausenteId: 'carlos',
          apelido: 'Apelido de carlos',
          desconectadoDesde: 500,
          votos: [
            { eleitorId: 'ana', esperar: true },
            { eleitorId: 'bia', esperar: null },
          ],
        },
      ],
      pausadaPeloDono: false,
      lendoRegras: null,
    });
  });

  it('deveMostrarQuemLeAsRegrasEOTempoQueResta', () => {
    const sala = mesa();
    sala.comecarLeituraDasRegras('bia', 1_000);
    const passo: ProximoPasso = { tipo: 'fimDaLeitura', jogadorId: 'bia', em: 61_000 };

    const estado = estadoExigido(sala, 'ana', { agora: 6_000, passo });
    expect(estado.pausa).toEqual({
      votacoes: [],
      pausadaPeloDono: false,
      lendoRegras: { jogadorId: 'bia', restanteMs: 55_000 },
    });
  });

  it('deveMostrarAPausaDoDono', () => {
    const sala = mesa();
    sala.pausar('ana');
    expect(estadoExigido(sala, 'carlos').pausa).toEqual({
      votacoes: [],
      pausadaPeloDono: true,
      lendoRegras: null,
    });
  });
});
