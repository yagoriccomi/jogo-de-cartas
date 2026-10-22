import { describe, expect, it } from 'vitest';
import {
  ALVOS,
  marcarAlvo,
  seletorDaCartaNaMao,
  seletorDaPlaca,
  seletorDeAlvo,
} from '../../../src/features/mesa/alvos';

describe('alvos da mesa', () => {
  it('deveMarcarEApontarPeloMesmoAtributo', () => {
    expect(marcarAlvo(ALVOS.palpite)).toEqual({ 'data-alvo': 'palpite' });
    expect(seletorDeAlvo(ALVOS.palpite)).toBe('[data-alvo="palpite"]');
  });

  it('deveDescerDeUmaAreaParaOutra', () => {
    expect(seletorDeAlvo(ALVOS.minhaArea, ALVOS.numeros)).toBe(
      '[data-alvo="minha-area"] [data-alvo="numeros"]',
    );
    expect(seletorDaPlaca('p1', ALVOS.testa)).toBe('[data-placa-jogador="p1"] [data-alvo="testa"]');
  });

  it('deveEscaparAspasDoIdSemDependerDoNavegador', () => {
    expect(seletorDaCartaNaMao('a"b\\c')).toBe('[data-carta-mao="a\\"b\\\\c"]');
  });
});
