import { PAUSAS_DO_FIM_DE_RODADA, type PartidaNoHistorico } from '@fodinha/shared';
import { describe, expect, it } from 'vitest';
import {
  descreverPosicao,
  esperaDoLance,
  PAUSA_DA_VAZA_FECHADA_MS,
  posicaoAnterior,
  progressoDoReplay,
  proximaPosicao,
  pularRodada,
  resolverLance,
  RITMO_DO_LANCE_MS,
  ULTIMO_LANCE,
} from '../../../src/features/replay/linhaDoTempo';
import { salaDoReplay, sessaoDoReplay } from '../../../src/features/replay/mesaDoReplay';
import { descreverColocacao, descreverMesa } from '../../../src/features/replay/textosDoHistorico';
import { EU, partida } from '../../apoio/partida';

describe('linha do tempo do replay', () => {
  it('deveAvancarDentroDaRodadaEDepoisAbrirAProxima', () => {
    expect(proximaPosicao({ rodada: 2, lance: 3 }, 5, 9)).toEqual({ rodada: 2, lance: 4 });
    expect(proximaPosicao({ rodada: 2, lance: 4 }, 5, 9)).toEqual({ rodada: 3, lance: 0 });
    expect(proximaPosicao({ rodada: 9, lance: 4 }, 5, 9)).toBeNull();
  });

  it('deveVoltarAoUltimoLanceDaRodadaAnteriorQuandoEstaNaAbertura', () => {
    expect(posicaoAnterior({ rodada: 3, lance: 2 })).toEqual({ rodada: 3, lance: 1 });
    expect(posicaoAnterior({ rodada: 3, lance: 0 })).toEqual({ rodada: 2, lance: ULTIMO_LANCE });
    expect(posicaoAnterior({ rodada: 1, lance: 0 })).toBeNull();
  });

  it('deveResolverOLanceContadoDoFimEPrenderNosLimites', () => {
    expect(resolverLance(ULTIMO_LANCE, 7)).toBe(6);
    expect(resolverLance(2, 7)).toBe(2);
    expect(resolverLance(40, 7)).toBe(6);
    expect(resolverLance(ULTIMO_LANCE, 0)).toBe(0);
  });

  it('devePularParaOComecoDaProximaRodadaMenosNaUltima', () => {
    expect(pularRodada({ rodada: 4, lance: 6 }, 9)).toEqual({ rodada: 5, lance: 0 });
    expect(pularRodada({ rodada: 9, lance: 0 }, 9)).toBeNull();
  });

  it('deveEsperarNoFimDaRodadaOMesmoTempoQueAoVivo', () => {
    const fim = partida({ fase: 'fim_de_rodada' });
    expect(esperaDoLance(fim, null)).toBe(PAUSAS_DO_FIM_DE_RODADA.normalMs);
    const cega = partida({ fase: 'fim_de_rodada', rodadaCega: true, cartasPorJogador: 1 });
    expect(esperaDoLance(cega, null)).toBe(
      PAUSAS_DO_FIM_DE_RODADA.normalMs + PAUSAS_DO_FIM_DE_RODADA.extraDaRodadaCegaMs,
    );
  });

  it('deveSegurarAVazaQueAcabouDeFecharEAndarNoRitmoNosOutrosLances', () => {
    const jogada = {
      jogadorId: 'a',
      carta: { id: 'c1', valor: '5', naipe: 'paus' },
      anulada: false,
    } as const;
    const comCarta = partida({ fase: 'jogando', mesa: [jogada] });
    const vazia = partida({ fase: 'jogando', mesa: [] });
    expect(esperaDoLance(vazia, comCarta)).toBe(PAUSA_DA_VAZA_FECHADA_MS);
    expect(esperaDoLance(comCarta, vazia)).toBe(RITMO_DO_LANCE_MS);
    expect(esperaDoLance(partida(), null)).toBe(RITMO_DO_LANCE_MS);
  });

  it('deveDescreverAPosicaoEOProgresso', () => {
    expect(descreverPosicao({ rodada: 3, lance: 3 }, 9, 17)).toBe('Rodada 3 de 17 · lance 4 de 9');
    expect(descreverPosicao({ rodada: 1, lance: 0 }, 0, 17)).toBe('Rodada 1 de 17');
    expect(progressoDoReplay({ rodada: 1, lance: 0 }, 5, 4)).toBe(0);
    expect(progressoDoReplay({ rodada: 4, lance: 4 }, 5, 4)).toBe(1);
    expect(progressoDoReplay({ rodada: 3, lance: 2 }, 5, 4)).toBeCloseTo(0.625);
  });
});

describe('mesa do replay', () => {
  it('deveMontarASalaSemDonoComOsJogadoresDoLance', () => {
    const sala = salaDoReplay(partida());
    expect(sala.participantes.map((p) => p.id)).toEqual(['a', 'b', EU, 'd']);
    expect(sala.participantes.every((p) => !p.ehAnfitriao && p.conectado)).toBe(true);
    expect(sessaoDoReplay(EU)).toMatchObject({ jogadorId: EU, tokenSessao: '' });
  });
});

describe('textos de Minhas partidas', () => {
  const base: PartidaNoHistorico = {
    id: 'p',
    iniciadaEm: 0,
    encerradaEm: 0,
    jogadores: 3,
    rodadas: 1,
    colocacao: 1,
    venceu: true,
  };

  it('deveDescreverAColocacao', () => {
    expect(descreverColocacao(base)).toBe('Venceu');
    expect(descreverColocacao({ ...base, venceu: false, colocacao: 3 })).toBe('3º lugar');
    expect(descreverColocacao({ ...base, venceu: false, colocacao: null })).toBe('Sem colocação');
  });

  it('deveDescreverAMesaNoSingularENoPlural', () => {
    expect(descreverMesa(base)).toBe('3 jogadores · 1 rodada');
    expect(descreverMesa({ ...base, rodadas: 12 })).toBe('3 jogadores · 12 rodadas');
  });
});
