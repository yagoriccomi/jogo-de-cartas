import { describe, expect, it } from 'vitest';
import { LIMITES, PAUSAS_DO_FIM_DE_RODADA, type VazaResolvida } from '@fodinha/shared';
import { DESTINO_DOS_EMPATES } from '../../../src/features/mesa/animacao-compartilhada';
import {
  abrirCena,
  cenaAtiva,
  chaveDaVaza,
  contagemVisivel,
  duracaoDaCenaMs,
  esperaAntesDoVooMs,
  levantarVoo,
  TEMPOS_DA_CENA,
  vistaDaCena,
  type ChegadaDaVaza,
} from '../../../src/features/mesa/cenaDaVaza';

/** O resultado da rodada fica ~6 s na tela, o tempo que os jogadores aprovaram. */
const RESULTADO_NA_TELA_MS = 6_000;

function vaza(cartas: number, vencedorId: string | null = 'a'): VazaResolvida {
  return {
    vencedorId,
    jogadas: Array.from({ length: cartas }, (_, indice) => ({
      jogadorId: indice === 0 ? 'a' : `j${indice}`,
      carta: { id: `c${indice}`, valor: '4', naipe: 'paus' },
      anulada: false,
    })),
  };
}

function chegada(campos: Partial<ChegadaDaVaza> = {}): ChegadaDaVaza {
  return {
    vaza: vaza(3),
    mesaVazia: true,
    rodadaCega: false,
    fimDeRodada: false,
    menosMovimento: false,
    ...campos,
  };
}

describe('chaveDaVaza', () => {
  it('deveIdentificarAVazaPeloVencedorEPelasCartas', () => {
    expect(chaveDaVaza(null)).toBeNull();
    expect(chaveDaVaza(vaza(2))).toBe('a:c0,c1');
    expect(chaveDaVaza(vaza(2, null))).toBe('-:c0,c1');
  });
});

describe('abrirCena', () => {
  it('deveAbrirNaEsperaComOsDadosDaRodada', () => {
    expect(abrirCena(chegada({ rodadaCega: true, fimDeRodada: true }))).toMatchObject({
      fase: 'espera',
      revelacao: true,
      ultima: true,
    });
  });

  it.each([
    ['sem vaza', { vaza: null }],
    ['com a mesa já ocupada', { mesaVazia: false }],
    ['com menos movimento', { menosMovimento: true }],
  ])('naoDeveAbrirCena %s', (_, campos) => {
    expect(abrirCena(chegada(campos))).toBeNull();
  });

  it('deveSairDeCenaQuandoAProximaVazaComeca', () => {
    const cena = abrirCena(chegada());
    expect(cenaAtiva(cena, true)).toBe(cena);
    expect(cenaAtiva(cena, false)).toBeNull();
  });
});

describe('linha do tempo', () => {
  it('deveSegurarAVazaDoMeioPoucoTempo', () => {
    const cena = { vaza: vaza(4), revelacao: false, ultima: false };
    expect(esperaAntesDoVooMs(cena)).toBe(TEMPOS_DA_CENA.pausaAntesDoVooMs);
  });

  it('deveSegurarAUltimaVazaMaisTempo', () => {
    const cena = { vaza: vaza(4), revelacao: false, ultima: true };
    expect(esperaAntesDoVooMs(cena)).toBe(TEMPOS_DA_CENA.pausaDaUltimaVazaMs);
  });

  it('deveEsperarAsCartasDaRodadaCegaChegaremEDesvirarem', () => {
    const poucas = esperaAntesDoVooMs({ vaza: vaza(2), revelacao: true, ultima: true });
    const muitas = esperaAntesDoVooMs({ vaza: vaza(10), revelacao: true, ultima: true });
    expect(poucas).toBeGreaterThan(TEMPOS_DA_CENA.pausaDaUltimaVazaMs);
    expect(muitas).toBeGreaterThan(poucas);
  });

  it('deveSomarOVooAEspera', () => {
    const cena = { vaza: vaza(3), revelacao: false, ultima: true };
    expect(duracaoDaCenaMs(cena)).toBe(esperaAntesDoVooMs(cena) + TEMPOS_DA_CENA.vooAoMonteMs);
  });
});

describe('a cena cabe na pausa de fim de rodada do servidor', () => {
  it('deveDeixarOResultadoNaTelaNaRodadaNormal', () => {
    const cena = { vaza: vaza(LIMITES.maxJogadores), revelacao: false, ultima: true };
    expect(duracaoDaCenaMs(cena) + RESULTADO_NA_TELA_MS).toBeLessThanOrEqual(
      PAUSAS_DO_FIM_DE_RODADA.normalMs,
    );
  });

  it('deveDeixarOResultadoNaTelaNaRodadaCegaComAMesaCheia', () => {
    const cena = { vaza: vaza(LIMITES.maxJogadores), revelacao: true, ultima: true };
    expect(duracaoDaCenaMs(cena) + RESULTADO_NA_TELA_MS).toBeLessThanOrEqual(
      PAUSAS_DO_FIM_DE_RODADA.normalMs + PAUSAS_DO_FIM_DE_RODADA.extraDaRodadaCegaMs,
    );
  });
});

describe('vistaDaCena', () => {
  it('deveSegurarResultadoEFimDePartidaEnquantoHaCena', () => {
    const cena = abrirCena(chegada({ fimDeRodada: true }));
    expect(vistaDaCena(cena, 'fim_de_rodada')).toMatchObject({
      voando: false,
      monteEmVoo: 'a',
      resultadoPodeAparecer: false,
    });
    expect(vistaDaCena(cena, 'encerrada').fimDePartidaPodeAparecer).toBe(false);
  });

  it('deveLiberarResultadoEFimDePartidaSemCena', () => {
    expect(vistaDaCena(null, 'fim_de_rodada')).toMatchObject({
      vaza: null,
      monteEmVoo: null,
      resultadoPodeAparecer: true,
      fimDePartidaPodeAparecer: false,
    });
    expect(vistaDaCena(null, 'encerrada').fimDePartidaPodeAparecer).toBe(true);
    expect(vistaDaCena(null, 'jogando').resultadoPodeAparecer).toBe(false);
    expect(vistaDaCena(null, null).resultadoPodeAparecer).toBe(false);
  });

  it('deveMandarAVazaAnuladaAoMonteDosEmpates', () => {
    const cena = abrirCena(chegada({ vaza: vaza(3, null) }));
    expect(vistaDaCena(cena, 'jogando').monteEmVoo).toBe(DESTINO_DOS_EMPATES);
  });

  it('deveMarcarOVooDepoisDaEspera', () => {
    const cena = abrirCena(chegada());
    if (cena === null) throw new Error('cena esperada');
    expect(vistaDaCena(levantarVoo(cena), 'jogando').voando).toBe(true);
  });
});

describe('contagemVisivel', () => {
  it('deveEsconderSoOMontinhoQueAindaVoaParaODono', () => {
    expect(contagemVisivel('a', 'a', 3)).toBe(2);
    expect(contagemVisivel('a', 'b', 3)).toBe(3);
    expect(contagemVisivel(null, 'a', 3)).toBe(3);
  });

  it('naoDeveFicarNegativaQuandoOEstadoChegaSemAVaza', () => {
    expect(contagemVisivel('a', 'a', 0)).toBe(0);
  });
});
