import {
  CONFIGURACAO_PADRAO,
  type Carta,
  type Jogada,
  type Naipe,
  type Valor,
} from '@fodinha/shared';
import { describe, expect, it } from 'vitest';
import { valoresEmJogo } from '../../src/domain/baralho';
import { EstrategiaDoBot } from '../../src/domain/estrategia-bot';
import type { JogadorNaVisao, VisaoDaPartida } from '../../src/domain/projecao';
import { organizarMesa } from '../../src/domain/vaza';
import { BOT_SEM_ERRO } from '../apoio';

/**
 * Um caso por situação de `answers/2026_10_22 bot-situacoes 001.md`.
 * Vira 4 → manilha 5. Ordem comum (sem 8-9-10): 4 6 7 Q J K A 2 3.
 */
const bot = new EstrategiaDoBot(BOT_SEM_ERRO);
const VALORES = valoresEmJogo(false);

function c(id: string, valor: Valor, naipe: Naipe = 'ouros'): Carta {
  return { id, valor, naipe };
}

function jogador(id: string, extra: Partial<JogadorNaVisao> = {}): JogadorNaVisao {
  return {
    id,
    vidas: 5,
    eliminado: false,
    palpite: 0,
    vazasFeitas: 0,
    vazasGanhas: [],
    cartasNaMao: 0,
    cartaNaTesta: null,
    maoRevelada: null,
    saiAoFimDaRodada: false,
    ...extra,
  };
}

interface Cena {
  /** Mão do bot (id `eu`). */
  readonly mao: Carta[];
  /** Todos os jogadores na ordem da mesa, inclusive `eu`. */
  readonly jogadores: JogadorNaVisao[];
  /** Cartas já jogadas nesta vaza, na ordem em que saíram. */
  readonly mesa?: [string, Carta][];
  readonly extra?: Partial<VisaoDaPartida>;
}

/** Monta a visão do bot; quem já jogou nesta vaza fica com uma carta a menos. */
function cena({ mao, jogadores, mesa = [], extra = {} }: Cena): VisaoDaPartida {
  const jogadas: Jogada[] = mesa.map(([jogadorId, carta]) => ({ jogadorId, carta }));
  const jogaram = new Set(jogadas.map((jogada) => jogada.jogadorId));
  return {
    configuracao: CONFIGURACAO_PADRAO,
    fase: 'jogando',
    numeroRodada: 3,
    cartasPorJogador: mao.length,
    rodadaCega: false,
    vira: c('vira', '4', 'copas'),
    manilha: '5',
    jogadores: jogadores.map((j) => ({
      ...j,
      cartasNaMao: j.cartasNaMao || (jogaram.has(j.id) ? mao.length - 1 : mao.length),
    })),
    idDoPe: null,
    idDoPrimeiro: null,
    idDaVez: 'eu',
    minhaMao: mao,
    mesa: organizarMesa(jogadas, '5', VALORES),
    ultimaVaza: null,
    vazasEmpatadas: [],
    palpiteProibido: null,
    resultadoRodada: null,
    vencedores: [],
    ...extra,
  };
}

const cumpriu = { palpite: 1, vazasFeitas: 1 };
const precisaDe1 = { palpite: 1, vazasFeitas: 0 };

describe('Bot — anular a carta de quem está ganhando', () => {
  it('anula o 3 de quem precisa da vaza, quando ele mesmo já cumpriu', () => {
    const visao = cena({
      mao: [c('tres', '3', 'copas'), c('sete', '7')],
      jogadores: [jogador('j1', precisaDe1), jogador('eu', cumpriu), jogador('j2'), jogador('j3')],
      mesa: [['j1', c('m', '3', 'paus')]],
    });

    expect(bot.escolherCarta(visao, 'eu')).toBe('tres');
  });

  it('não anula quem já cumpriu: deixa ele levar a vaza a mais e perder vida', () => {
    const visao = cena({
      mao: [c('tres', '3', 'copas'), c('sete', '7')],
      jogadores: [
        jogador('j1', cumpriu),
        jogador('j2', precisaDe1),
        jogador('j3', precisaDe1),
        jogador('eu', cumpriu),
      ],
      mesa: [
        ['j1', c('m1', '3', 'paus')],
        ['j2', c('m2', 'K', 'paus')],
        ['j3', c('m3', 'Q', 'paus')],
      ],
    });

    expect(bot.escolherCarta(visao, 'eu')).toBe('sete');
  });
});

describe('Bot — sabotagem mira em quem tem mais vidas', () => {
  function mesaComDoisCumpridos(vidasDeJ1: number, vidasDeJ2: number): VisaoDaPartida {
    // O 3 anula o de j1 e entrega a vaza ao K de j2; o 7 deixa a vaza com j1.
    return cena({
      mao: [c('tres', '3', 'copas'), c('sete', '7')],
      jogadores: [
        jogador('j1', { ...cumpriu, vidas: vidasDeJ1 }),
        jogador('j2', { ...cumpriu, vidas: vidasDeJ2 }),
        jogador('eu', cumpriu),
      ],
      mesa: [
        ['j1', c('m1', '3', 'paus')],
        ['j2', c('m2', 'K', 'paus')],
      ],
    });
  }

  it('dá a vaza a mais a j2 quando é ele quem tem mais vidas', () => {
    expect(bot.escolherCarta(mesaComDoisCumpridos(2, 6), 'eu')).toBe('tres');
  });

  it('dá a vaza a mais a j1 quando é ele quem tem mais vidas', () => {
    expect(bot.escolherCarta(mesaComDoisCumpridos(6, 2), 'eu')).toBe('sete');
  });

  it('com vidas iguais, tira a vaza de quem está para acertar', () => {
    const visao = cena({
      mao: [c('tres', '3', 'copas'), c('sete', '7')],
      jogadores: [
        jogador('j1', { palpite: 1, vazasFeitas: 0 }),
        jogador('j2', { palpite: 2, vazasFeitas: 0 }),
        jogador('eu', cumpriu),
      ],
      mesa: [
        ['j1', c('m1', '3', 'paus')],
        ['j2', c('m2', 'K', 'paus')],
      ],
    });

    expect(bot.escolherCarta(visao, 'eu')).toBe('tres');
  });
});

describe('Bot — risco de ser superado ou anulado depois (memória da última vaza)', () => {
  function cenaComUltimaVaza(ultimaVaza: Carta[]): VisaoDaPartida {
    return cena({
      mao: [c('dois', '2', 'copas'), c('manilha', '5', 'paus')],
      jogadores: [
        jogador('j1', { palpite: 1, vazasFeitas: 1 }),
        jogador('eu', precisaDe1),
        jogador('j2', { palpite: 0 }),
      ],
      mesa: [['j1', c('m', 'Q', 'paus')]],
      extra: {
        ultimaVaza: {
          jogadas: ultimaVaza.map((carta, i) => ({
            jogadorId: ['j1', 'eu', 'j2'][i] as string,
            carta,
            anulada: false,
          })),
          vencedorId: 'j1',
        },
      },
    });
  }

  it('usa a manilha quando não sabe onde estão as outras', () => {
    const visao = cenaComUltimaVaza([c('u1', '4'), c('u2', '6'), c('u3', '7')]);

    expect(bot.escolherCarta(visao, 'eu')).toBe('manilha');
  });

  it('guarda a manilha quando viu as outras três saírem na última vaza', () => {
    const visao = cenaComUltimaVaza([
      c('u1', '5', 'ouros'),
      c('u2', '5', 'espadas'),
      c('u3', '5', 'copas'),
    ]);

    expect(bot.escolherCarta(visao, 'eu')).toBe('dois');
  });

  it('ignora a última vaza da rodada anterior', () => {
    const visao = cenaComUltimaVaza([
      c('u1', '5', 'ouros'),
      c('u2', '5', 'espadas'),
      c('u3', '5', 'copas'),
    ]);
    const rodadaNova: VisaoDaPartida = {
      ...visao,
      jogadores: visao.jogadores.map((j) => ({ ...j, vazasFeitas: 0 })),
    };

    expect(bot.escolherCarta(rodadaNova, 'eu')).toBe('manilha');
  });
});

describe('Bot — quando precisa da vaza', () => {
  it('é o último da vaza: a menor carta que ganha basta', () => {
    const visao = cena({
      mao: [c('rei', 'K'), c('tres', '3'), c('quatro', '4')],
      jogadores: [jogador('j1'), jogador('j2'), jogador('eu', precisaDe1)],
      mesa: [
        ['j1', c('m1', 'Q', 'paus')],
        ['j2', c('m2', '6', 'paus')],
      ],
    });

    expect(bot.escolherCarta(visao, 'eu')).toBe('rei');
  });

  it('ainda falta gente: prefere a carta mais difícil de superar', () => {
    const visao = cena({
      mao: [c('rei', 'K'), c('tres', '3'), c('quatro', '4')],
      jogadores: [jogador('j1'), jogador('eu', precisaDe1), jogador('j2'), jogador('j3')],
      mesa: [['j1', c('m1', 'Q', 'paus')]],
    });

    expect(bot.escolherCarta(visao, 'eu')).toBe('tres');
  });

  it('a vaza está perdida: joga a menor e guarda a manilha', () => {
    const visao = cena({
      mao: [c('manilha', '5', 'copas'), c('quatro', '4')],
      jogadores: [jogador('j1'), jogador('eu', precisaDe1), jogador('j2'), jogador('j3')],
      mesa: [['j1', c('m1', '5', 'paus')]],
    });

    expect(bot.escolherCarta(visao, 'eu')).toBe('quatro');
  });

  it('palpite impossível de alcançar: abre com a mais forte para salvar o que der', () => {
    const visao = cena({
      mao: [c('quatro', '4'), c('rei', 'K')],
      jogadores: [jogador('eu', { palpite: 3, vazasFeitas: 0 }), jogador('j1'), jogador('j2')],
    });

    expect(bot.escolherCarta(visao, 'eu')).toBe('rei');
  });
});

describe('Bot — esperar a posição de último da vaza', () => {
  function cenaDaPosicao(palpiteDeJ2: number): VisaoDaPartida {
    return cena({
      mao: [c('rei', 'K'), c('quatro', '4')],
      jogadores: [
        jogador('j1'),
        jogador('eu', precisaDe1),
        jogador('j2', { palpite: palpiteDeJ2 }),
        jogador('j3'),
      ],
      mesa: [['j1', c('m1', '6', 'paus')]],
    });
  }

  it('deixa quem joga logo depois fazer a vaza dele, para fechar a próxima', () => {
    expect(bot.escolherCarta(cenaDaPosicao(1), 'eu')).toBe('quatro');
  });

  it('se quem vem depois não precisa de vaza, tenta ganhar já', () => {
    expect(bot.escolherCarta(cenaDaPosicao(0), 'eu')).toBe('rei');
  });

  it('sem folga não espera: precisa de todas as vazas que restam', () => {
    const visao = cena({
      mao: [c('rei', 'K'), c('quatro', '4')],
      jogadores: [
        jogador('j1'),
        jogador('eu', { palpite: 2, vazasFeitas: 0 }),
        jogador('j2', precisaDe1),
        jogador('j3'),
      ],
      mesa: [['j1', c('m1', '6', 'paus')]],
    });

    expect(bot.escolherCarta(visao, 'eu')).toBe('rei');
  });
});

describe('Bot — escada para não ganhar a vaza', () => {
  it('degraus 1-2: iguala a maior força já anulada', () => {
    const visao = cena({
      mao: [c('dama', 'Q', 'copas'), c('sete', '7', 'copas'), c('quatro', '4')],
      jogadores: [
        jogador('j1'),
        jogador('j2'),
        jogador('j3'),
        jogador('j4'),
        jogador('j5', cumpriu),
        jogador('eu', cumpriu),
      ],
      mesa: [
        ['j1', c('m1', 'Q', 'paus')],
        ['j2', c('m2', 'Q', 'espadas')],
        ['j3', c('m3', '7', 'paus')],
        ['j4', c('m4', '7', 'espadas')],
        ['j5', c('m5', 'K', 'paus')],
      ],
    });

    expect(bot.escolherCarta(visao, 'eu')).toBe('dama');
  });

  it('degrau 4: antes do pé, com 3 e A na mesa, joga a maior abaixo do A', () => {
    const visao = cena({
      mao: [c('rei', 'K'), c('sete', '7'), c('dois', '2')],
      jogadores: [
        jogador('j1', cumpriu),
        jogador('j2', cumpriu),
        jogador('eu', cumpriu),
        jogador('j3', cumpriu),
      ],
      mesa: [
        ['j1', c('m1', '3', 'paus')],
        ['j2', c('m2', 'A', 'paus')],
      ],
    });

    expect(bot.escolherCarta(visao, 'eu')).toBe('rei');
  });

  it('degrau 5: sem carta segura, joga a que fica abaixo de todas', () => {
    const visao = cena({
      mao: [c('as', 'A'), c('dama', 'Q'), c('quatro', '4')],
      jogadores: [
        jogador('j1', cumpriu),
        jogador('j2', cumpriu),
        jogador('eu', cumpriu),
        jogador('j3'),
        jogador('j4'),
      ],
      mesa: [
        ['j1', c('m1', 'K', 'paus')],
        ['j2', c('m2', '6', 'paus')],
      ],
    });

    expect(bot.escolherCarta(visao, 'eu')).toBe('quatro');
  });

  it('degrau 6: sem nada abaixo de todas, joga uma abaixo da que ganha', () => {
    const visao = cena({
      mao: [c('as', 'A'), c('dama', 'Q')],
      jogadores: [
        jogador('j1', cumpriu),
        jogador('j2', cumpriu),
        jogador('eu', cumpriu),
        jogador('j3'),
        jogador('j4'),
      ],
      mesa: [
        ['j1', c('m1', 'K', 'paus')],
        ['j2', c('m2', '6', 'paus')],
      ],
    });

    expect(bot.escolherCarta(visao, 'eu')).toBe('dama');
  });

  it('degrau 7: tudo ganha e ainda falta gente: joga a menor', () => {
    const visao = cena({
      mao: [c('as', 'A'), c('tres', '3')],
      jogadores: [jogador('j1'), jogador('eu', cumpriu), jogador('j2')],
      mesa: [['j1', c('m1', '6', 'paus')]],
    });

    expect(bot.escolherCarta(visao, 'eu')).toBe('as');
  });

  it('degrau 8: é o pé e tudo ganha: joga a maior, a vaza era inevitável', () => {
    const visao = cena({
      mao: [c('as', 'A'), c('tres', '3')],
      jogadores: [jogador('j1'), jogador('j2'), jogador('eu', cumpriu)],
      mesa: [
        ['j1', c('m1', '6', 'paus')],
        ['j2', c('m2', '7', 'paus')],
      ],
    });

    expect(bot.escolherCarta(visao, 'eu')).toBe('tres');
  });

  it('palpite estourado: foge da vaza com a carta que perde', () => {
    const visao = cena({
      mao: [c('as', 'A'), c('seis', '6')],
      jogadores: [jogador('j1'), jogador('eu', { palpite: 1, vazasFeitas: 2 })],
      mesa: [['j1', c('m1', 'K', 'paus')]],
    });

    expect(bot.escolherCarta(visao, 'eu')).toBe('seis');
  });

  it('vaza toda anulada: iguala de novo e ninguém leva', () => {
    const visao = cena({
      mao: [c('dama', 'Q', 'copas'), c('tres', '3')],
      jogadores: [jogador('j1'), jogador('j2'), jogador('eu', cumpriu)],
      mesa: [
        ['j1', c('m1', 'Q', 'paus')],
        ['j2', c('m2', 'Q', 'espadas')],
      ],
    });

    expect(bot.escolherCarta(visao, 'eu')).toBe('dama');
  });
});

describe('Bot — palpite', () => {
  function cenaDePalpite(mao: Carta[], outros: JogadorNaVisao[]): VisaoDaPartida {
    return cena({
      mao,
      jogadores: [...outros, jogador('eu', { palpite: null })],
      extra: { fase: 'palpites' },
    });
  }

  it('pede menos quando a mesa já pediu mais do que a média', () => {
    const mao = [c('m', '5', 'espadas'), c('tres', '3'), c('quatro', '4')];
    const mesaContida = cenaDePalpite(mao, [
      jogador('j1', { palpite: 0 }),
      jogador('j2', { palpite: 0 }),
    ]);
    const mesaGulosa = cenaDePalpite(mao, [
      jogador('j1', { palpite: 3 }),
      jogador('j2', { palpite: 3 }),
    ]);

    expect(bot.escolherPalpite(mesaContida, [0, 1, 2, 3])).toBe(2);
    expect(bot.escolherPalpite(mesaGulosa, [0, 1, 2, 3])).toBe(0);
  });
});

describe('Bot — rodada cega: os palpites dos outros são pista da própria carta', () => {
  function cenaCega(outros: JogadorNaVisao[]): VisaoDaPartida {
    return cena({
      mao: [],
      jogadores: [...outros, jogador('eu', { palpite: null })],
      extra: {
        fase: 'palpites',
        rodadaCega: true,
        cartasPorJogador: 1,
        minhaMao: [{ id: 'oculta', oculta: true }],
      },
    });
  }

  it('quem pediu 1 vendo a minha carta indica que ela perde', () => {
    const semPista = cenaCega([
      jogador('j1', { cartaNaTesta: c('x', 'Q'), palpite: null }),
      jogador('j2', { cartaNaTesta: c('y', 'J'), palpite: null }),
    ]);
    const comPista = cenaCega([
      jogador('j1', { cartaNaTesta: c('x', 'Q'), palpite: null }),
      jogador('j2', { cartaNaTesta: c('y', 'J'), palpite: 1 }),
    ]);

    expect(bot.escolherPalpite(semPista, [0, 1])).toBe(1);
    expect(bot.escolherPalpite(comPista, [0, 1])).toBe(0);
  });

  it('quem pediu 0 vendo só carta fraca além da minha indica que a minha é forte', () => {
    const semPista = cenaCega([
      jogador('j1', { cartaNaTesta: c('x', 'K'), palpite: null }),
      jogador('j2', { cartaNaTesta: c('y', 'Q'), palpite: null }),
    ]);
    // j1 não vê o próprio K: além da minha, só vê a Q de j2. Se pediu 0, foi por causa da minha.
    const comPista = cenaCega([
      jogador('j1', { cartaNaTesta: c('x', 'K'), palpite: 0 }),
      jogador('j2', { cartaNaTesta: c('y', 'Q'), palpite: null }),
    ]);

    expect(bot.escolherPalpite(semPista, [0, 1])).toBe(0);
    expect(bot.escolherPalpite(comPista, [0, 1])).toBe(1);
  });
});

describe('Bot — margem de erro', () => {
  const visao = cena({
    mao: [c('as', 'A'), c('seis', '6')],
    jogadores: [jogador('j1'), jogador('eu', { palpite: 1, vazasFeitas: 2 })],
    mesa: [['j1', c('m1', 'K', 'paus')]],
  });

  it('quando o sorteio cai na margem, joga a segunda melhor', () => {
    const errado = new EstrategiaDoBot(() => 0.05);

    expect(errado.escolherCarta(visao, 'eu')).toBe('as');
  });

  it('erra cerca de uma vez em cada dez', () => {
    let semente = 0;
    const sorteio = () => (semente++ % 100) / 100;
    const comErro = new EstrategiaDoBot(sorteio);

    const erros = Array.from({ length: 100 }, () => comErro.escolherCarta(visao, 'eu')).filter(
      (id) => id === 'as',
    ).length;

    expect(erros).toBe(10);
  });
});
