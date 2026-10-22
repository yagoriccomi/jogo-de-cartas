import { LIMITES } from '@fodinha/shared';
import { describe, expect, it } from 'vitest';
import {
  mesmoPasso,
  proximoPasso,
  registrarMarco,
  type Etapa,
  type MarcoDaEtapa,
  type SituacaoDaMesa,
  type TemposDaMesa,
} from '../../src/domain/agenda';

const TEMPOS: TemposDaMesa = {
  atrasoDoBotMs: 900,
  pausaFimDeRodadaMs: 4_000,
  pausaExtraRodadaCegaMs: 3_000,
};
const PRAZO_MS = 30_000;

const vezDe = (jogadorId: string, andamento = 0, conduzidoPorBot = false): Etapa => ({
  tipo: 'vez',
  andamento,
  jogadorId,
  conduzidoPorBot,
});
const fimDeRodada = (rodadaCega = false, andamento = 5): Etapa => ({
  tipo: 'fimDeRodada',
  andamento,
  rodadaCega,
});

/** Mesa correndo, sem leitura das regras e com prazo de 30 s, salvo o que o teste mudar. */
function situacao(
  etapa: Etapa | null,
  marco: MarcoDaEtapa | null,
  extras: Partial<SituacaoDaMesa> = {},
): SituacaoDaMesa {
  return { etapa, marco, leitura: null, pausada: false, prazoDaVezMs: PRAZO_MS, ...extras };
}

describe('registrarMarco', () => {
  it('deveComecarAContarQuandoAEtapaMuda', () => {
    const primeira = registrarMarco(null, { etapa: vezDe('ana'), pausada: false, agora: 1_000 });
    const segunda = registrarMarco(primeira, {
      etapa: vezDe('bia', 1),
      pausada: false,
      agora: 5_000,
    });
    expect(primeira?.desde).toBe(1_000);
    expect(segunda?.desde).toBe(5_000);
  });

  it('deveManterOInicioQuandoAEtapaContinuaAMesma', () => {
    const marco = registrarMarco(null, { etapa: vezDe('ana'), pausada: false, agora: 1_000 });
    const depois = registrarMarco(marco, { etapa: vezDe('ana'), pausada: false, agora: 9_000 });
    expect(depois).toBe(marco);
  });

  it('deveTratarComoEtapaNovaOMesmoJogadorComAVezDeNovo', () => {
    // Quem ganha a vaza abre a próxima: mesma pessoa, mas o prazo recomeça.
    const marco = registrarMarco(null, { etapa: vezDe('ana', 3), pausada: false, agora: 1_000 });
    const nova = registrarMarco(marco, { etapa: vezDe('ana', 4), pausada: false, agora: 2_000 });
    expect(nova?.desde).toBe(2_000);
  });

  it('deveTratarComoEtapaNovaQuandoOBotAssumeAVez', () => {
    const marco = registrarMarco(null, { etapa: vezDe('ana'), pausada: false, agora: 1_000 });
    const comBot = registrarMarco(marco, {
      etapa: vezDe('ana', 0, true),
      pausada: false,
      agora: 2_000,
    });
    expect(comBot?.desde).toBe(2_000);
  });

  it('deveSomarADuracaoDaPausaAoRetomar', () => {
    let marco = registrarMarco(null, { etapa: vezDe('ana'), pausada: false, agora: 0 });
    marco = registrarMarco(marco, { etapa: vezDe('ana'), pausada: true, agora: 10_000 });
    marco = registrarMarco(marco, { etapa: vezDe('ana'), pausada: true, agora: 50_000 });
    marco = registrarMarco(marco, { etapa: vezDe('ana'), pausada: false, agora: 70_000 });
    expect(marco).toEqual(expect.objectContaining({ desde: 0, pausadaPorMs: 60_000 }));
    expect(marco?.pausadaDesde).toBeNull();
  });

  it('deveNascerPausadaQuandoAEtapaComecaComAMesaParada', () => {
    const marco = registrarMarco(null, { etapa: vezDe('ana'), pausada: true, agora: 3_000 });
    expect(marco?.pausadaDesde).toBe(3_000);
  });

  it('deveSumirSemEtapa', () => {
    const marco = registrarMarco(null, { etapa: vezDe('ana'), pausada: false, agora: 0 });
    expect(registrarMarco(marco, { etapa: null, pausada: false, agora: 1 })).toBeNull();
  });
});

describe('proximoPasso', () => {
  const marcoEm = (etapa: Etapa, agora: number) =>
    registrarMarco(null, { etapa, pausada: false, agora });

  it('deveEstourarOPrazoDoHumanoNoInstanteAbsoluto', () => {
    const etapa = vezDe('ana');
    expect(proximoPasso(situacao(etapa, marcoEm(etapa, 2_000)), TEMPOS)).toEqual({
      tipo: 'prazoDaVez',
      jogadorId: 'ana',
      em: 2_000 + PRAZO_MS,
    });
  });

  it('deveFazerOBotJogarDepoisDoAtraso', () => {
    const etapa = vezDe('bot', 0, true);
    expect(proximoPasso(situacao(etapa, marcoEm(etapa, 2_000)), TEMPOS)).toEqual({
      tipo: 'jogadaDoBot',
      jogadorId: 'bot',
      em: 2_900,
    });
  });

  it('naoDeveAgendarNadaParaOHumanoSemLimiteDeTempo', () => {
    const etapa = vezDe('ana');
    const semLimite = situacao(etapa, marcoEm(etapa, 0), { prazoDaVezMs: null });
    expect(proximoPasso(semLimite, TEMPOS)).toBeNull();
  });

  it('deveDistribuirAProximaRodadaDepoisDaPausaComOExtraDaCega', () => {
    const comum = fimDeRodada(false);
    const cega = fimDeRodada(true);
    expect(proximoPasso(situacao(comum, marcoEm(comum, 1_000)), TEMPOS)).toEqual({
      tipo: 'proximaRodada',
      em: 5_000,
    });
    expect(proximoPasso(situacao(cega, marcoEm(cega, 1_000)), TEMPOS)?.em).toBe(8_000);
  });

  it('deveCongelarTudoNaPausa', () => {
    const etapa = vezDe('ana');
    const pausada = situacao(etapa, marcoEm(etapa, 0), { pausada: true });
    expect(proximoPasso(pausada, TEMPOS)).toBeNull();
  });

  it('deveContinuarDoQueRestavaDepoisDaPausa', () => {
    const etapa = vezDe('ana');
    let marco = registrarMarco(null, { etapa, pausada: false, agora: 0 });
    marco = registrarMarco(marco, { etapa, pausada: true, agora: 10_000 });
    marco = registrarMarco(marco, { etapa, pausada: false, agora: 100_000 });
    // 10 s corridos antes da pausa: sobram 20 s a partir da retomada.
    expect(proximoPasso(situacao(etapa, marco), TEMPOS)?.em).toBe(120_000);
  });

  it('deveEncerrarALeituraDasRegrasNoLimiteMesmoComAMesaPausada', () => {
    const etapa = vezDe('ana');
    const lendo = situacao(etapa, marcoEm(etapa, 0), {
      pausada: true,
      leitura: { jogadorId: 'bia', desde: 7_000 },
    });
    expect(proximoPasso(lendo, TEMPOS)).toEqual({
      tipo: 'fimDaLeitura',
      jogadorId: 'bia',
      em: 7_000 + LIMITES.maxLeituraDasRegrasSegundos * 1000,
    });
  });

  it('naoDeveAgendarComOMarcoDeOutraEtapa', () => {
    const marco = marcoEm(vezDe('ana'), 0);
    expect(proximoPasso(situacao(vezDe('bia', 1), marco), TEMPOS)).toBeNull();
  });

  it('naoDeveAgendarSemPartidaEmJogo', () => {
    expect(proximoPasso(situacao(null, null), TEMPOS)).toBeNull();
  });
});

describe('mesmoPasso', () => {
  it('deveCompararTipoJogadorEInstante', () => {
    const passo = { tipo: 'prazoDaVez', jogadorId: 'ana', em: 1 } as const;
    expect(mesmoPasso(passo, { ...passo })).toBe(true);
    expect(mesmoPasso(passo, { ...passo, em: 2 })).toBe(false);
    expect(mesmoPasso(passo, { ...passo, jogadorId: 'bia' })).toBe(false);
    expect(mesmoPasso(passo, null)).toBe(false);
    expect(mesmoPasso(null, null)).toBe(true);
  });
});
