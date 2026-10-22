import { CONFIGURACAO_PADRAO } from '@fodinha/shared';
import { describe, expect, it } from 'vitest';
import type { Partida } from '../../src/domain/partida';
import { Sala, type Participante } from '../../src/domain/sala';
import { geradorComSemente, jogarRodadaAteOFim } from '../apoio';

function participante(id: string, ehBot = false): Participante {
  return {
    id,
    apelido: id,
    ehBot,
    perfilDoBot: null,
    conectado: true,
    tokenSessao: ehBot ? null : `token-${id}`,
    dispositivoId: ehBot ? null : `disp-${id}`,
  };
}

/** Ana (dona), Bia, Carlos e um bot, já em partida. */
function mesaComTresHumanos(): { sala: Sala; partida: Partida } {
  const sala = new Sala('SALA', participante('ana'), CONFIGURACAO_PADRAO);
  sala.adicionarHumano(participante('bia'));
  sala.adicionarHumano(participante('carlos'));
  sala.adicionarBot('ana', participante('bot', true));
  const partida = sala.iniciarPartida('ana', geradorComSemente(7));
  return { sala, partida };
}

/** Carlos caiu e a carência dele venceu: Ana e Bia decidem se esperam. */
function votacaoDoCarlosAberta(): { sala: Sala; partida: Partida } {
  const mesa = mesaComTresHumanos();
  mesa.sala.marcarConexao('carlos', false);
  expect(mesa.sala.abrirVotacao('carlos', 0)).toEqual({ eliminados: [] });
  return mesa;
}

describe('Sala — invariantes da votação de espera', () => {
  it('deveEliminarOAusenteNoVotoQueCompletaOsNao', () => {
    const { sala, partida } = votacaoDoCarlosAberta();

    expect(sala.votar('ana', 'carlos', false)).toEqual({ eliminados: [] });
    expect(sala.votar('bia', 'carlos', false)).toEqual({ eliminados: ['carlos'] });
    expect(sala.votacoesVisiveis()).toEqual([]);
    expect(sala.pausada).toBe(false);
    expect(partida.estaJogando('carlos')).toBe(false);
  });

  it('deveResolverAVotacaoQuandoOEleitorQueFaltavaSai', () => {
    const { sala } = votacaoDoCarlosAberta();
    sala.votar('ana', 'carlos', false);

    expect(sala.sair('bia')).toEqual({ eliminados: ['carlos'] });
    expect(sala.votacoesVisiveis()).toEqual([]);
  });

  it('deveResolverAVotacaoQuandoOEleitorQueFaltavaEExpulso', () => {
    const { sala } = votacaoDoCarlosAberta();
    sala.votar('ana', 'carlos', false);

    expect(sala.expulsar('ana', 'bia')).toEqual({
      expulsoId: 'bia',
      eraHumano: true,
      eliminados: ['carlos'],
    });
  });

  it('naoDeveAbrirVotacaoParaQuemNaoPrecisa', () => {
    const { sala } = mesaComTresHumanos();
    expect(sala.abrirVotacao('bia', 0)).toBeNull();
  });

  it('deveSeguirSemEleitoresQuandoAlguemVoltaAAssistir', () => {
    const { sala } = mesaComTresHumanos();
    // Dani chega no meio (só senta na próxima rodada) e cai; depois caem todos os que jogam.
    sala.adicionarHumano(participante('dani'));
    sala.marcarConexao('dani', false);
    for (const id of ['bia', 'carlos', 'ana']) {
      sala.marcarConexao(id, false);
      expect(sala.abrirVotacao(id, 0)).toEqual({ eliminados: [] });
    }
    expect(sala.votacoesVisiveis()).toHaveLength(3);

    // Ninguém pode votar, mas agora alguém assiste: a mesa não fica presa esperando.
    const { eliminados } = sala.marcarConexao('dani', true);
    expect([...eliminados].sort()).toEqual(['ana', 'bia', 'carlos']);
    expect(sala.votacoesVisiveis()).toEqual([]);
  });
});

describe('Sala — saída no meio da rodada', () => {
  it('deveManterQuemSaiAteOFimDaRodadaEDescartarDepois', () => {
    const { sala, partida } = mesaComTresHumanos();

    expect(sala.sair('bia')).toEqual({ eliminados: [] });
    expect(sala.estaSaindo('bia')).toBe(true);
    expect(sala.todos.map((p) => p.id)).toContain('bia');
    expect(sala.ativos().map((p) => p.id)).not.toContain('bia');
    expect(sala.participanteAtivo('bia')).toBeUndefined();
    expect(sala.estado().participantes.find((p) => p.id === 'bia')?.saindo).toBe(true);

    jogarRodadaAteOFim(partida);
    expect(sala.todos.map((p) => p.id)).toContain('bia');
    partida.iniciarProximaRodada();

    expect(partida.participa('bia')).toBe(false);
    expect(sala.todos.map((p) => p.id)).not.toContain('bia');
    expect(sala.estado().participantes.map((p) => p.id)).toEqual(['ana', 'carlos', 'bot']);
  });

  it('deveTirarQuemSaiAssimQueAPartidaTermina', () => {
    const sala = new Sala('SALA', participante('ana'), CONFIGURACAO_PADRAO);
    sala.adicionarHumano(participante('bia'));
    const partida = sala.iniciarPartida('ana', geradorComSemente(3));

    sala.sair('bia');
    jogarRodadaAteOFim(partida);

    expect(partida.faseAtual).toBe('encerrada');
    expect(sala.emPartida).toBe(false);
    expect(sala.todos.map((p) => p.id)).toEqual(['ana']);
  });
});
