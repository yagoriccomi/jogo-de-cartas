import { describe, expect, it } from 'vitest';
import {
  normalizarVolume,
  VOLUME_MAXIMO,
  VOLUME_MINIMO,
  volumeParaGanho,
} from '../../../src/features/som/preferencia';

const INICIAL = 50;

describe('normalizarVolume', () => {
  it('deveAceitarNumeroOuTextoNumericoDentroDaFaixa', () => {
    expect(normalizarVolume(30, INICIAL)).toBe(30);
    expect(normalizarVolume('70', INICIAL)).toBe(70);
  });

  it('deveArredondarEPrenderNaFaixa', () => {
    expect(normalizarVolume(33.6, INICIAL)).toBe(34);
    expect(normalizarVolume(-10, INICIAL)).toBe(VOLUME_MINIMO);
    expect(normalizarVolume(250, INICIAL)).toBe(VOLUME_MAXIMO);
  });

  it.each([null, undefined, '', '  ', 'alto', Number.NaN, Number.POSITIVE_INFINITY, {}])(
    'deveVoltarAoInicialComLixoNoStorage (%s)',
    (lixo) => {
      expect(normalizarVolume(lixo, INICIAL)).toBe(INICIAL);
    },
  );
});

describe('volumeParaGanho', () => {
  it('deveIrDoSilencioAoGanhoCheio', () => {
    expect(volumeParaGanho(VOLUME_MINIMO)).toBe(0);
    expect(volumeParaGanho(VOLUME_MAXIMO)).toBe(1);
  });

  it('deveSeguirACurvaDoOuvidoEmVezDeLinear', () => {
    expect(volumeParaGanho(50)).toBeCloseTo(0.25);
  });
});
