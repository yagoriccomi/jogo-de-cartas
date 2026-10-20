import { describe, expect, it } from 'vitest';
import { montarBaralhoEmbaralhado, totalDeCartas, valoresEmJogo } from '../../src/domain/baralho';
import { validarConfiguracao } from '../../src/domain/configuracao';
import { forcaDaCarta, valorDaManilha } from '../../src/domain/forca';
import {
  maxCartasPorJogador,
  palpiteProibidoDoPe,
  proximaQuantidadeDeCartas,
  vidasPerdidas,
} from '../../src/domain/rodadas';
import { organizarMesa, resolverVaza } from '../../src/domain/vaza';
import { carta, geradorComSemente } from '../apoio';

const TRUCO = valoresEmJogo(false);

describe('baralho', () => {
  it('deveTer40CartasPorBaralhoSemOitoNoveDez', () => {
    expect(
      totalDeCartas({
        quantidadeBaralhos: 1,
        vidasIniciais: 5,
        incluirOitoNoveDez: false,
        mortosVeemCartas: false,
        prazoDaVezSegundos: 30,
      }),
    ).toBe(40);
  });

  it('deveTer52CartasPorBaralhoComOitoNoveDezEMultiplicarPelosBaralhos', () => {
    expect(
      totalDeCartas({
        quantidadeBaralhos: 4,
        vidasIniciais: 5,
        incluirOitoNoveDez: true,
        mortosVeemCartas: false,
        prazoDaVezSegundos: 30,
      }),
    ).toBe(208);
  });

  it('deveGerarIdsUnicosEOpacosMesmoComVariosBaralhos', () => {
    const cartas = montarBaralhoEmbaralhado(
      {
        quantidadeBaralhos: 2,
        vidasIniciais: 5,
        incluirOitoNoveDez: false,
        mortosVeemCartas: false,
        prazoDaVezSegundos: 30,
      },
      geradorComSemente(1),
    );
    expect(cartas).toHaveLength(80);
    expect(new Set(cartas.map((c) => c.id)).size).toBe(80);
    expect(cartas.every((c) => /^c\d+$/.test(c.id))).toBe(true);
  });
});

describe('configuração', () => {
  it.each([
    { quantidadeBaralhos: 0, vidasIniciais: 5, incluirOitoNoveDez: false, mortosVeemCartas: false },
    { quantidadeBaralhos: 5, vidasIniciais: 5, incluirOitoNoveDez: false, mortosVeemCartas: false },
    { quantidadeBaralhos: 1, vidasIniciais: 4, incluirOitoNoveDez: false, mortosVeemCartas: false },
    {
      quantidadeBaralhos: 1,
      vidasIniciais: 11,
      incluirOitoNoveDez: false,
      mortosVeemCartas: false,
      prazoDaVezSegundos: 30,
    },
    {
      quantidadeBaralhos: 1.5,
      vidasIniciais: 5,
      incluirOitoNoveDez: false,
      mortosVeemCartas: false,
      prazoDaVezSegundos: 30,
    },
    { quantidadeBaralhos: 1, vidasIniciais: 5, incluirOitoNoveDez: false, mortosVeemCartas: 'sim' },
  ])('deveRejeitarConfiguracaoForaDosLimites %o', (configuracao) => {
    expect(() => validarConfiguracao(configuracao)).toThrow();
  });
});

describe('manilha e força', () => {
  it('deveSerOValorSeguinteAVira', () => {
    expect(valorDaManilha('7', TRUCO)).toBe('Q');
    expect(valorDaManilha('K', TRUCO)).toBe('A');
  });

  it('deveVoltarAoQuatroQuandoAViraEhTres', () => {
    expect(valorDaManilha('3', TRUCO)).toBe('4');
  });

  it('devePularOitoNoveDezNoBaralhoDeTruco', () => {
    expect(valorDaManilha('7', valoresEmJogo(true))).toBe('8');
  });

  it('deveOrdenarManilhasPorNaipeAcimaDeQualquerCartaComum', () => {
    const forcaDe = (c: ReturnType<typeof carta>) => forcaDaCarta(c, '4', TRUCO);
    expect(forcaDe(carta('4', 'ouros'))).toBeGreaterThan(forcaDe(carta('3', 'paus')));
    expect(forcaDe(carta('4', 'espadas'))).toBeGreaterThan(forcaDe(carta('4', 'ouros')));
    expect(forcaDe(carta('4', 'copas'))).toBeGreaterThan(forcaDe(carta('4', 'espadas')));
    expect(forcaDe(carta('4', 'paus'))).toBeGreaterThan(forcaDe(carta('4', 'copas')));
  });

  it('naoDeveDesempatarCartasComunsPeloNaipe', () => {
    expect(forcaDaCarta(carta('A', 'paus'), '4', TRUCO)).toBe(
      forcaDaCarta(carta('A', 'ouros'), '4', TRUCO),
    );
  });
});

describe('resolução da vaza', () => {
  it('deveDarAVazaACartaMaisForte', () => {
    const jogadas = [
      { jogadorId: 'a', carta: carta('K', 'ouros') },
      { jogadorId: 'b', carta: carta('3', 'copas') },
      { jogadorId: 'c', carta: carta('A', 'espadas') },
    ];
    expect(resolverVaza(jogadas, '5', TRUCO)).toBe('b');
  });

  it('deveAnularCartasIguaisEDarAVazaAProximaMaior', () => {
    const jogadas = [
      { jogadorId: 'a', carta: carta('3', 'ouros') },
      { jogadorId: 'b', carta: carta('3', 'copas') },
      { jogadorId: 'c', carta: carta('2', 'espadas') },
      { jogadorId: 'd', carta: carta('2', 'paus') },
      { jogadorId: 'e', carta: carta('Q', 'paus') },
    ];
    expect(resolverVaza(jogadas, '5', TRUCO)).toBe('e');
  });

  it('deveDeixarAVazaSemDonoQuandoTodasSeAnulam', () => {
    const jogadas = [
      { jogadorId: 'a', carta: carta('K', 'ouros') },
      { jogadorId: 'b', carta: carta('K', 'copas') },
    ];
    expect(resolverVaza(jogadas, '5', TRUCO)).toBeNull();
  });

  it('deveAnularManilhasIdenticasDeBaralhosDiferentes', () => {
    const jogadas = [
      { jogadorId: 'a', carta: carta('5', 'paus') },
      { jogadorId: 'b', carta: carta('5', 'paus') },
      { jogadorId: 'c', carta: carta('5', 'ouros') },
    ];
    expect(resolverVaza(jogadas, '5', TRUCO)).toBe('c');
  });
});

describe('rodadas e pontuação', () => {
  it('deveReservarUmaCartaParaAVira', () => {
    expect(maxCartasPorJogador(40, 10)).toBe(3);
    expect(maxCartasPorJogador(40, 3)).toBe(13);
  });

  it('deveSubirDeUmEmUmEVoltarParaUmAoPassarDoMaximo', () => {
    expect(proximaQuantidadeDeCartas(null, 3)).toBe(1);
    expect(proximaQuantidadeDeCartas(1, 3)).toBe(2);
    expect(proximaQuantidadeDeCartas(3, 3)).toBe(1);
    expect(proximaQuantidadeDeCartas(5, 4)).toBe(1);
  });

  it('deveProibirOPalpiteQueFechaASoma', () => {
    expect(palpiteProibidoDoPe(2, 3)).toBe(1);
    expect(palpiteProibidoDoPe(0, 3)).toBe(3);
  });

  it('naoDeveProibirNadaQuandoASomaJaPassouDasCartas', () => {
    expect(palpiteProibidoDoPe(4, 3)).toBeNull();
  });

  it('devePerderUmaVidaPorVazaDeDiferenca', () => {
    expect(vidasPerdidas(3, 1)).toBe(2);
    expect(vidasPerdidas(0, 2)).toBe(2);
    expect(vidasPerdidas(2, 2)).toBe(0);
  });
});

describe('cartas anuladas na mesa', () => {
  it('deveOrdenarPorForcaEMarcarComoAnuladasSoAsQueEmpatam', () => {
    const jogadas = [
      { jogadorId: 'a', carta: carta('3', 'ouros') },
      { jogadorId: 'b', carta: carta('K', 'copas') },
      { jogadorId: 'c', carta: carta('3', 'paus') },
      { jogadorId: 'd', carta: carta('5', 'paus') },
    ];
    const marcadas = organizarMesa(jogadas, '5', TRUCO);
    // Ordenadas da mais forte para a mais fraca: manilha (5♣), os dois 3 (empatados), K.
    expect(marcadas.map((j) => [j.jogadorId, j.anulada])).toEqual([
      ['d', false],
      ['a', true],
      ['c', true],
      ['b', false],
    ]);
  });

  it('naoDeveAnularManilhasDeNaipesDiferentes', () => {
    const jogadas = [
      { jogadorId: 'a', carta: carta('5', 'ouros') },
      { jogadorId: 'b', carta: carta('5', 'paus') },
    ];
    expect(organizarMesa(jogadas, '5', TRUCO).some((j) => j.anulada)).toBe(false);
  });
});
