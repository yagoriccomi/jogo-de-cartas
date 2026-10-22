import { describe, expect, it } from 'vitest';
import type { Carta, CartaNaMao, CartaOculta } from '@fodinha/shared';
import { TEMPOS_DA_ANIMACAO } from '../../../src/features/mesa/animacao-compartilhada';
import {
  comecaDistribuindo,
  idsDasOcultas,
  mudancaDaMao,
  planejarDistribuicao,
  registrarMao,
  vistaDaMao,
  type EntradaDaVistaDaMao,
} from '../../../src/features/mesa/planoDaMao';

function carta(id: string): Carta {
  return { id, valor: '4', naipe: 'paus' };
}

function oculta(id: string): CartaOculta {
  return { id, oculta: true };
}

const MAO = [carta('c1'), carta('c2'), carta('c3')];

function mudanca(
  antes: readonly CartaNaMao[],
  depois: readonly CartaNaMao[],
  rodadas: readonly [number | undefined, number | undefined] = [2, 2],
) {
  return mudancaDaMao(registrarMao(antes, rodadas[0]), registrarMao(depois, rodadas[1]));
}

function vista(campos: Partial<EntradaDaVistaDaMao> = {}) {
  return vistaDaMao({
    cartas: MAO,
    chegando: false,
    podeJogar: true,
    toque: false,
    destacarDica: false,
    ...campos,
  });
}

/** Sorteio fixo: sempre o maior índice, então os lugares ficam na ordem recebida. */
const SEM_EMBARALHAR = () => 0.999;

describe('mudancaDaMao', () => {
  it('naoDeveMudarComAMesmaMao', () => {
    expect(mudanca(MAO, [...MAO])).toBe('nenhuma');
  });

  it('deveDistribuirNaRodadaNova', () => {
    expect(mudanca(MAO, [carta('n1'), carta('n2')], [2, 3])).toBe('maoNova');
  });

  it('deveDistribuirNaRodadaNovaMesmoComOsMesmosIds', () => {
    expect(mudanca(MAO, MAO, [2, 3])).toBe('maoNova');
  });

  it('naoDeveDistribuirQuandoUmaCartaEJogada', () => {
    expect(mudanca(MAO, [carta('c1'), carta('c3')])).toBe('mesmaMao');
  });

  it('naoDeveDistribuirQuandoAMaoEsvazia', () => {
    expect(mudanca(MAO, [], [2, 3])).toBe('mesmaMao');
  });

  it('deveDistribuirQuandoQuemEntrouNoMeioRecebeASuaPrimeiraMao', () => {
    expect(mudanca([], MAO, [2, 3])).toBe('maoNova');
  });

  it('deveUsarSoOsIdsQuandoARodadaNaoEInformada', () => {
    expect(mudanca(MAO, [carta('n1')], [undefined, undefined])).toBe('maoNova');
    expect(mudanca(MAO, [carta('c1')], [undefined, undefined])).toBe('mesmaMao');
  });

  it('deveNotarACartaOcultaQueViraComumSemRedistribuir', () => {
    expect(mudanca([oculta('c1')], [carta('c1')], [1, 1])).toBe('mesmaMao');
  });
});

describe('comecaDistribuindo', () => {
  it('deveDistribuirAoMontarSoNaAbertura', () => {
    const inicio = { animarAoMontar: true, quantidade: 3, menosMovimento: false };
    expect(comecaDistribuindo(inicio)).toBe(true);
    // Reconectar ou entrar no meio mostra a mão pronta.
    expect(comecaDistribuindo({ ...inicio, animarAoMontar: false })).toBe(false);
    expect(comecaDistribuindo({ ...inicio, quantidade: 0 })).toBe(false);
    expect(comecaDistribuindo({ ...inicio, menosMovimento: true })).toBe(false);
  });
});

describe('planejarDistribuicao', () => {
  const { embaralharMs, intervaloDaDistribuicaoMs } = TEMPOS_DA_ANIMACAO;

  it('deveReceberUmaCartaPorVoltaDaMesaDepoisDoEmbaralhar', () => {
    const voos = planejarDistribuicao({
      ocultas: [false, false, false],
      jogadoresNaMesa: 4,
      sortear: SEM_EMBARALHAR,
    });
    expect(voos.map((voo) => voo.atrasoMs)).toEqual([
      embaralharMs,
      embaralharMs + 4 * intervaloDaDistribuicaoMs,
      embaralharMs + 8 * intervaloDaDistribuicaoMs,
    ]);
    expect(voos.every((voo) => voo.desvira)).toBe(true);
  });

  it('devePousarCadaCartaNumLugarDiferenteSorteado', () => {
    const voos = planejarDistribuicao({
      ocultas: [false, false, false, false],
      jogadoresNaMesa: 2,
      sortear: () => 0,
    });
    const lugares = voos.map((voo) => voo.lugar);
    expect(lugares).toEqual([1, 2, 3, 0]);
    expect([...lugares].sort()).toEqual([0, 1, 2, 3]);
  });

  it('deveVoarSemDesvirarNaRodadaCega', () => {
    const voos = planejarDistribuicao({
      ocultas: [true],
      jogadoresNaMesa: 4,
      sortear: SEM_EMBARALHAR,
    });
    expect(voos).toEqual([{ lugar: 0, atrasoMs: embaralharMs, desvira: false }]);
  });
});

describe('vistaDaMao', () => {
  it('deveEnsinarOGestoNaMinhaVez', () => {
    expect(vista()).toMatchObject({ interativa: true, dica: expect.stringContaining('Clique') });
    expect(vista({ toque: true }).dica).toBe('Toque para escolher, toque duas vezes para jogar');
    expect(vista({ destacarDica: true }).ensinandoGesto).toBe(true);
  });

  it('deveContarAsCartasForaDaMinhaVez', () => {
    expect(vista({ podeJogar: false })).toMatchObject({
      interativa: false,
      ensinandoGesto: false,
      dica: 'Sua mão · 3 cartas',
    });
  });

  it('deveTravarEDesenharOVersoEnquantoAsCartasChegam', () => {
    const chegando = vista({ chegando: true, destacarDica: true });
    expect(chegando).toMatchObject({ interativa: false, ensinandoGesto: false });
    expect(chegando.versos).toEqual([true, true, true]);
    expect(vista().versos).toEqual([false, false, false]);
  });

  it('deveTravarAMaoNaRodadaCega', () => {
    const cega = vista({ cartas: [oculta('x')], chegando: true });
    expect(cega).toMatchObject({
      todasOcultas: true,
      interativa: false,
      dica: 'Rodada cega · sua carta fica virada e é revelada na mesa',
    });
    // A carta oculta já é verso: não ganha outro por cima.
    expect(cega.versos).toEqual([false]);
  });

  it('deveEsconderAOrdemComUmaCarta', () => {
    const uma = vista({ cartas: [carta('c1')], podeJogar: false });
    expect(uma).toMatchObject({ mostrarOrdem: false, dica: 'Sua mão · 1 carta' });
    expect(vista().mostrarOrdem).toBe(true);
  });
});

describe('idsDasOcultas', () => {
  it('deveListarSoAsCartasOcultas', () => {
    expect(idsDasOcultas([oculta('x'), carta('c1'), oculta('y')])).toEqual(['x', 'y']);
    expect(idsDasOcultas(MAO)).toEqual([]);
  });
});
