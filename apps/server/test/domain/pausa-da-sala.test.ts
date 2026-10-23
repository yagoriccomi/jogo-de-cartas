import { CONFIGURACAO_PADRAO, type CodigoErro } from '@fodinha/shared';
import { describe, expect, it } from 'vitest';
import { ErroDeRegra } from '../../src/domain/erros';
import { criarEstrategiasDosPerfis } from '../../src/domain/estrategia-bot';
import { Sala, type Participante } from '../../src/domain/sala';
import { BOT_SEM_ERRO, geradorComSemente } from '../apoio';

const estrategias = criarEstrategiasDosPerfis(BOT_SEM_ERRO);

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

/** Ana (dona), Bia e um bot, já em partida com `cartas` na primeira rodada. */
function mesa(cartas: number): Sala {
  const sala = new Sala('SALA', participante('ana'), CONFIGURACAO_PADRAO);
  sala.adicionarHumano(participante('bia'));
  sala.adicionarBot('ana', participante('bot', true));
  sala.iniciarPartida('ana', geradorComSemente(7), cartas);
  return sala;
}

function vezDe(sala: Sala): string {
  return sala.partida?.idDaVez as string;
}

/** Joga pela vez até a partida chegar à fase pedida. */
function avancarAte(sala: Sala, fase: 'jogando' | 'fim_de_rodada'): void {
  for (let i = 0; i < 50 && sala.partida?.faseAtual !== fase; i++) {
    sala.jogarAVez(vezDe(sala), estrategias);
  }
  expect(sala.partida?.faseAtual).toBe(fase);
}

function codigoDoErro(acao: () => unknown): CodigoErro | null {
  try {
    acao();
    return null;
  } catch (erro) {
    if (erro instanceof ErroDeRegra) return erro.codigo;
    throw erro;
  }
}

/** Os três jeitos de a mesa congelar; cada um devolve como desfazê-lo. */
const PAUSAS: readonly { nome: string; pausar: (sala: Sala) => () => void }[] = [
  {
    nome: 'pausa do dono',
    pausar: (sala) => {
      sala.pausar('ana');
      return () => sala.retomar('ana');
    },
  },
  {
    nome: 'votação de espera por ausente',
    pausar: (sala) => {
      sala.marcarConexao('bia', false);
      sala.abrirVotacao('bia', 0);
      return () => sala.marcarConexao('bia', true);
    },
  },
  {
    nome: 'leitura das regras',
    pausar: (sala) => {
      sala.comecarLeituraDasRegras('ana', 0);
      return () => sala.encerrarLeituraDasRegras('ana');
    },
  },
];

describe('Sala — a pausa congela todas as jogadas', () => {
  for (const { nome, pausar } of PAUSAS) {
    describe(nome, () => {
      it('deveRecusarPalpiteEJogarAVezSemMudarAPartida', () => {
        const sala = mesa(3);
        const quem = vezDe(sala);
        const andamento = sala.partida?.andamento;
        pausar(sala);

        expect(sala.pausada).toBe(true);
        expect(codigoDoErro(() => sala.palpitar(quem, 0))).toBe('JOGO_PAUSADO');
        expect(codigoDoErro(() => sala.jogarAVez(quem, estrategias))).toBe('JOGO_PAUSADO');
        expect(sala.partida?.andamento).toBe(andamento);
        expect(vezDe(sala)).toBe(quem);
      });

      it('deveRecusarCarta', () => {
        const sala = mesa(3);
        avancarAte(sala, 'jogando');
        const quem = vezDe(sala);
        const cartaId = sala.partida?.cartasNaMaoDe(quem)[0]?.id as string;
        pausar(sala);

        expect(codigoDoErro(() => sala.jogarCarta(quem, cartaId))).toBe('JOGO_PAUSADO');
        expect(sala.partida?.cartasNaMaoDe(quem).some((c) => c.id === cartaId)).toBe(true);
      });

      it('deveRecusarAProximaRodada', () => {
        const sala = mesa(1);
        avancarAte(sala, 'fim_de_rodada');
        pausar(sala);

        expect(codigoDoErro(() => sala.iniciarProximaRodada())).toBe('JOGO_PAUSADO');
        expect(sala.partida?.faseAtual).toBe('fim_de_rodada');
      });

      it('deveVoltarAAceitarJogadasQuandoAPausaAcaba', () => {
        const sala = mesa(3);
        const quem = vezDe(sala);
        const despausar = pausar(sala);
        despausar();

        expect(sala.pausada).toBe(false);
        expect(codigoDoErro(() => sala.jogarAVez(quem, estrategias))).toBeNull();
        expect(vezDe(sala)).not.toBe(quem);
      });
    });
  }

  it('deveRecusarJogadaSemPartidaEmAndamento', () => {
    const sala = new Sala('SALA', participante('ana'), CONFIGURACAO_PADRAO);

    expect(codigoDoErro(() => sala.palpitar('ana', 0))).toBe('JOGADA_INVALIDA');
    expect(codigoDoErro(() => sala.jogarCarta('ana', 'x'))).toBe('JOGADA_INVALIDA');
    expect(codigoDoErro(() => sala.jogarAVez('ana', estrategias))).toBe('JOGADA_INVALIDA');
    expect(codigoDoErro(() => sala.iniciarProximaRodada())).toBe('JOGADA_INVALIDA');
  });

  it('deveJogarAVezDeHumanosEBotsAteFecharOsPalpites', () => {
    const sala = mesa(3);
    for (let i = 0; i < 3; i++) {
      const quem = vezDe(sala);
      expect(sala.jogarAVez(quem, estrategias).tipo).toBe('palpite');
    }
    expect(sala.partida?.faseAtual).toBe('jogando');
  });
});
