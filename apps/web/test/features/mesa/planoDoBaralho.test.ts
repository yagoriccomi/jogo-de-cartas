import { describe, expect, it } from 'vitest';
import { TEMPOS_DA_ANIMACAO } from '../../../src/features/mesa/animacao-compartilhada';
import {
  JANELA_DE_ABERTURA_MS,
  MAXIMO_DE_VOOS_POR_JOGADOR,
  atrasoNaEntregaMs,
  esperaAteAViraMs,
  estaNaAberturaDaPartida,
  planejarBaralho,
  planejarEntrega,
  type EntradaDoBaralho,
} from '../../../src/features/mesa/planoDoBaralho';
import { EU, jogador, partida } from '../../apoio/partida';

const RECEBIDO_EM = 10_000;

function baralho(campos: Partial<EntradaDoBaralho> = {}): EntradaDoBaralho {
  return {
    jogo: partida(),
    meuId: EU,
    primeiraVez: false,
    recebidoEm: RECEBIDO_EM,
    agora: RECEBIDO_EM,
    menosMovimento: false,
    ...campos,
  };
}

describe('planejarEntrega', () => {
  it('deveDarUmaCartaPorJogadorACadaVoltaComecandoPelaMao', () => {
    const jogo = partida({ idDoPrimeiro: 'b', cartasPorJogador: 2 });
    const comDuas = partida({
      ...jogo,
      jogadores: jogo.jogadores.map((j) => ({ ...j, cartasNaMao: 2 })),
    });
    expect(planejarEntrega(comDuas, EU)).toEqual(['b', null, 'd', 'a', 'b', null, 'd', 'a']);
  });

  it('deveMarcarMinhasCartasComoNullParaAMaoAnimar', () => {
    expect(planejarEntrega(partida(), EU).filter((destino) => destino === null)).toHaveLength(3);
    expect(planejarEntrega(partida(), null)).not.toContain(null);
  });

  it('devePularEliminadosEQuemEsperaSentar', () => {
    const jogo = partida({
      jogadores: [
        jogador('a', { cartasNaMao: 1 }),
        jogador('b', { eliminado: true, cartasNaMao: 0 }),
        jogador(EU, { cartasNaMao: 1 }),
        // Entrou no meio da partida: só recebe cartas na próxima rodada.
        jogador('novo', { cartasNaMao: 0 }),
      ],
    });
    expect(planejarEntrega(jogo, EU)).toEqual(['a', null]);
  });

  it('deveComecarDoPrimeiroDaListaQuandoAMaoNaoEstaNaMesa', () => {
    const jogo = partida({
      idDoPrimeiro: 'sumiu',
      jogadores: [jogador('a', { cartasNaMao: 1 }), jogador('b', { cartasNaMao: 1 })],
    });
    expect(planejarEntrega(jogo, EU)).toEqual(['a', 'b']);
  });

  it('deveLimitarAsVoltasNasRodadasLongas', () => {
    const jogo = partida({
      jogadores: [jogador('a', { cartasNaMao: 13 }), jogador(EU, { cartasNaMao: 13 })],
    });
    expect(planejarEntrega(jogo, EU)).toHaveLength(2 * MAXIMO_DE_VOOS_POR_JOGADOR);
  });

  it('deveEntregarUmaCartaSoNaRodadaDeUma', () => {
    const jogo = partida({
      cartasPorJogador: 1,
      rodadaCega: true,
      jogadores: [jogador('a', { cartasNaMao: 1 }), jogador(EU, { cartasNaMao: 1 })],
    });
    expect(planejarEntrega(jogo, EU)).toEqual(['a', null]);
  });

  it('deveFicarVaziaSeNinguemTemCartas', () => {
    const jogo = partida({ jogadores: [jogador('a', { cartasNaMao: 0 })] });
    expect(planejarEntrega(jogo, EU)).toEqual([]);
  });
});

describe('estaNaAberturaDaPartida', () => {
  it('deveValerNosPalpitesSemNinguemTerPalpitadoLogoQueOEstadoChega', () => {
    expect(estaNaAberturaDaPartida(partida(), RECEBIDO_EM, RECEBIDO_EM + 100)).toBe(true);
  });

  it('deveExpirarDepoisDaJanela', () => {
    const agora = RECEBIDO_EM + JANELA_DE_ABERTURA_MS;
    expect(estaNaAberturaDaPartida(partida(), RECEBIDO_EM, agora - 1)).toBe(true);
    expect(estaNaAberturaDaPartida(partida(), RECEBIDO_EM, agora)).toBe(false);
  });

  it('naoDeveValerDepoisDoPrimeiroPalpiteNemForaDosPalpites', () => {
    const palpitou = partida({ jogadores: [jogador('a', { palpite: 1 }), jogador(EU)] });
    expect(estaNaAberturaDaPartida(palpitou, RECEBIDO_EM, RECEBIDO_EM)).toBe(false);
    expect(estaNaAberturaDaPartida(partida({ fase: 'jogando' }), RECEBIDO_EM, RECEBIDO_EM)).toBe(
      false,
    );
  });
});

describe('planejarBaralho', () => {
  it('deveDistribuirTodaRodadaNova', () => {
    expect(planejarBaralho(baralho({ agora: RECEBIDO_EM + 60_000 }))).toEqual(
      planejarEntrega(partida(), EU),
    );
  });

  it('deveDistribuirNaPrimeiraVezSoNaAberturaDaPartida', () => {
    expect(planejarBaralho(baralho({ primeiraVez: true }))).not.toBeNull();
    // Reconectou (ou entrou) com a rodada correndo: as cartas já estavam nas mãos.
    const emJogo = partida({ fase: 'jogando' });
    expect(planejarBaralho(baralho({ primeiraVez: true, jogo: emJogo }))).toBeNull();
    const tarde = RECEBIDO_EM + JANELA_DE_ABERTURA_MS;
    expect(planejarBaralho(baralho({ primeiraVez: true, agora: tarde }))).toBeNull();
  });

  it('naoDeveAnimarComMenosMovimento', () => {
    expect(planejarBaralho(baralho({ menosMovimento: true }))).toBeNull();
    expect(planejarBaralho(baralho({ primeiraVez: true, menosMovimento: true }))).toBeNull();
  });
});

describe('ritmo da entrega', () => {
  const { intervaloDaDistribuicaoMs, vooDaCartaMs } = TEMPOS_DA_ANIMACAO;

  it('deveEspacarAsCartasPeloIntervaloDaDistribuicao', () => {
    expect(atrasoNaEntregaMs(0)).toBe(0);
    expect(atrasoNaEntregaMs(3)).toBe(3 * intervaloDaDistribuicaoMs);
  });

  it('deveVirarAViraQuandoAUltimaCartaPousa', () => {
    expect(esperaAteAViraMs(['a', null, 'b'])).toBe(2 * intervaloDaDistribuicaoMs + vooDaCartaMs);
    expect(esperaAteAViraMs(['a'])).toBe(vooDaCartaMs);
    expect(esperaAteAViraMs([])).toBe(vooDaCartaMs);
  });
});
