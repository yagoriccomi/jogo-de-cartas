import { CONFIGURACAO_PADRAO, type Carta, type Naipe, type Valor } from '@fodinha/shared';
import { describe, expect, it } from 'vitest';
import { EstrategiaDoBot } from '../../src/domain/estrategia-bot';
import { BOT_SEM_ERRO } from '../apoio';
import type { JogadorNaVisao, VisaoDaPartida } from '../../src/domain/projecao';

const estrategia = new EstrategiaDoBot(BOT_SEM_ERRO);

// Vira 4 → manilha 5. Ordem comum: 4 5 6 7 Q J K A 2 3 (o 5 vira manilha).
const VIRA: Carta = { id: 'vira', valor: '4', naipe: 'ouros' };

function c(id: string, valor: Valor, naipe: Naipe): Carta {
  return { id, valor, naipe };
}

function jogador(id: string, extra: Partial<JogadorNaVisao> = {}): JogadorNaVisao {
  return {
    id,
    vidas: 5,
    eliminado: false,
    palpite: null,
    vazasFeitas: 0,
    vazasGanhas: [],
    cartasNaMao: 0,
    cartaNaTesta: null,
    maoRevelada: null,
    saiAoFimDaRodada: false,
    ...extra,
  };
}

function visaoBase(extra: Partial<VisaoDaPartida>): VisaoDaPartida {
  return {
    configuracao: CONFIGURACAO_PADRAO,
    fase: 'jogando',
    numeroRodada: 1,
    cartasPorJogador: 3,
    rodadaCega: false,
    vira: VIRA,
    manilha: '5',
    jogadores: [jogador('eu'), jogador('j1'), jogador('j2'), jogador('j3')],
    idDoPe: null,
    idDoPrimeiro: null,
    idDaVez: 'eu',
    minhaMao: [],
    mesa: [],
    ultimaVaza: null,
    vazasEmpatadas: [],
    palpiteProibido: null,
    resultadoRodada: null,
    vencedores: [],
    ...extra,
  };
}

describe('EstrategiaDoBot — palpite', () => {
  const permitidos = [0, 1, 2, 3];

  it('deve palpitar mais com mão forte do que com mão fraca', () => {
    const forte = visaoBase({
      fase: 'palpites',
      minhaMao: [c('a', '5', 'paus'), c('b', '5', 'copas'), c('c', '3', 'ouros')],
    });
    const fraca = visaoBase({
      fase: 'palpites',
      minhaMao: [c('a', '4', 'paus'), c('b', '6', 'copas'), c('c', '7', 'ouros')],
    });

    expect(estrategia.escolherPalpite(forte, permitidos)).toBe(2);
    expect(estrategia.escolherPalpite(fraca, permitidos)).toBe(0);
  });

  it('deve valorizar mais cartas altas quando há poucos adversários', () => {
    const mao = [c('a', '3', 'paus'), c('b', '2', 'copas')];
    const dupla = visaoBase({
      fase: 'palpites',
      minhaMao: mao,
      jogadores: [jogador('eu'), jogador('j1')],
    });
    const mesaCheia = visaoBase({
      fase: 'palpites',
      minhaMao: mao,
      jogadores: ['eu', 'j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'j7'].map((id) => jogador(id)),
    });

    expect(estrategia.escolherPalpite(dupla, permitidos)).toBeGreaterThan(
      estrategia.escolherPalpite(mesaCheia, permitidos),
    );
  });

  it('deve ir para o lado mais provável quando o desejado é proibido (pé)', () => {
    const visao = visaoBase({
      fase: 'palpites',
      minhaMao: [c('a', '5', 'paus'), c('b', '5', 'copas'), c('c', '3', 'ouros')],
      palpiteProibido: 2,
    });

    const palpite = estrategia.escolherPalpite(visao, [0, 1, 3]);

    // Espera ~2,25 vazas: o 3 fica mais perto que o 1.
    expect(palpite).toBe(3);
  });

  it('deve palpitar 1 na rodada cega quando as cartas visíveis são fracas', () => {
    const visao = visaoBase({
      fase: 'palpites',
      rodadaCega: true,
      cartasPorJogador: 1,
      minhaMao: [{ id: 'oculta', oculta: true }],
      jogadores: [
        jogador('eu'),
        jogador('j1', { cartaNaTesta: c('x', '4', 'paus') }),
        jogador('j2', { cartaNaTesta: c('y', '6', 'copas') }),
      ],
    });

    expect(estrategia.escolherPalpite(visao, [0, 1])).toBe(1);
  });

  it('deve palpitar 0 na rodada cega quando alguém tem manilha ou carta muito forte', () => {
    const comManilha = visaoBase({
      fase: 'palpites',
      rodadaCega: true,
      cartasPorJogador: 1,
      minhaMao: [{ id: 'oculta', oculta: true }],
      jogadores: [
        jogador('eu'),
        jogador('j1', { cartaNaTesta: c('x', '5', 'paus') }),
        jogador('j2', { cartaNaTesta: c('y', '6', 'copas') }),
      ],
    });
    const comTres = visaoBase({
      ...comManilha,
      jogadores: [
        jogador('eu'),
        jogador('j1', { cartaNaTesta: c('x', '3', 'paus') }),
        jogador('j2', { cartaNaTesta: c('y', '6', 'copas') }),
      ],
    });

    expect(estrategia.escolherPalpite(comManilha, [0, 1])).toBe(0);
    expect(estrategia.escolherPalpite(comTres, [0, 1])).toBe(0);
  });
});

describe('EstrategiaDoBot — jogada', () => {
  function visaoDaVez(opcoes: {
    minhaMao: Carta[];
    mesa?: { jogadorId: string; carta: Carta }[];
    palpite: number;
    vazasFeitas: number;
    adversarios?: number;
  }): VisaoDaPartida {
    const adversarios = ['j1', 'j2', 'j3'].slice(0, opcoes.adversarios ?? 3);
    return visaoBase({
      minhaMao: opcoes.minhaMao,
      mesa: (opcoes.mesa ?? []).map((jogada) => ({ ...jogada, anulada: false })),
      jogadores: [
        jogador('eu', { palpite: opcoes.palpite, vazasFeitas: opcoes.vazasFeitas }),
        ...adversarios.map((id) => jogador(id, { cartasNaMao: opcoes.minhaMao.length })),
      ],
    });
  }

  it('deve vencer com a carta mais barata que ganha quando é o último da vaza', () => {
    const visao = visaoDaVez({
      minhaMao: [c('fraca', '4', 'paus'), c('rei', 'K', 'copas'), c('tres', '3', 'ouros')],
      mesa: [{ jogadorId: 'j1', carta: c('m', 'Q', 'paus') }],
      palpite: 1,
      vazasFeitas: 0,
      adversarios: 1,
    });

    expect(estrategia.escolherCarta(visao, 'eu')).toBe('rei');
  });

  it('deve considerar a anulação: carta igual à da mesa não ganha', () => {
    const visao = visaoDaVez({
      minhaMao: [c('igual', 'Q', 'copas'), c('maior', 'A', 'copas')],
      mesa: [{ jogadorId: 'j1', carta: c('m', 'Q', 'paus') }],
      palpite: 1,
      vazasFeitas: 0,
    });

    expect(estrategia.escolherCarta(visao, 'eu')).toBe('maior');
  });

  it('deve descartar a mais fraca quando precisa de vaza mas não consegue vencer', () => {
    const visao = visaoDaVez({
      minhaMao: [c('a', '4', 'paus'), c('b', '7', 'copas')],
      mesa: [{ jogadorId: 'j1', carta: c('m', '3', 'paus') }],
      palpite: 1,
      vazasFeitas: 0,
    });

    expect(estrategia.escolherCarta(visao, 'eu')).toBe('a');
  });

  it('deve evitar vencer quando já cumpriu o palpite, jogando a maior carta que perde', () => {
    const visao = visaoDaVez({
      minhaMao: [c('fraca', '4', 'paus'), c('media', '6', 'copas'), c('tres', '3', 'ouros')],
      mesa: [{ jogadorId: 'j1', carta: c('m', 'K', 'paus') }],
      palpite: 1,
      vazasFeitas: 1,
    });

    expect(estrategia.escolherCarta(visao, 'eu')).toBe('media');
  });

  it('deve usar a anulação para não vencer quando só há cartas fortes', () => {
    const visao = visaoDaVez({
      minhaMao: [c('igual', 'K', 'copas'), c('tres', '3', 'ouros')],
      mesa: [{ jogadorId: 'j1', carta: c('m', 'K', 'paus') }],
      palpite: 0,
      vazasFeitas: 0,
    });

    expect(estrategia.escolherCarta(visao, 'eu')).toBe('igual');
  });

  it('deve jogar a mais fraca se qualquer carta venceria e o palpite já foi cumprido', () => {
    const visao = visaoDaVez({
      minhaMao: [c('a', 'A', 'paus'), c('b', '3', 'copas')],
      mesa: [{ jogadorId: 'j1', carta: c('m', '6', 'paus') }],
      palpite: 0,
      vazasFeitas: 0,
    });

    expect(estrategia.escolherCarta(visao, 'eu')).toBe('a');
  });

  it('deve abrir com a mais forte quando precisa de todas as vazas restantes', () => {
    const visao = visaoDaVez({
      minhaMao: [c('fraca', '4', 'paus'), c('forte', '5', 'paus')],
      palpite: 2,
      vazasFeitas: 0,
    });

    expect(estrategia.escolherCarta(visao, 'eu')).toBe('forte');
  });

  it('deve abrir com a mais fraca quando já cumpriu o palpite', () => {
    const visao = visaoDaVez({
      minhaMao: [c('fraca', '4', 'paus'), c('forte', '5', 'paus')],
      palpite: 1,
      vazasFeitas: 1,
    });

    expect(estrategia.escolherCarta(visao, 'eu')).toBe('fraca');
  });

  it('deve ser determinístico para o mesmo estado', () => {
    const visao = visaoDaVez({
      minhaMao: [c('a', '6', 'paus'), c('b', '6', 'copas'), c('c', 'K', 'ouros')],
      mesa: [{ jogadorId: 'j1', carta: c('m', '4', 'paus') }],
      palpite: 1,
      vazasFeitas: 0,
    });

    expect(estrategia.escolherCarta(visao, 'eu')).toBe(estrategia.escolherCarta(visao, 'eu'));
  });
});
