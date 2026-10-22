import { beforeEach, describe, expect, it } from 'vitest';
import {
  normalizarVolume,
  somLigado,
  volumeDaMusica,
  volumeDasReacoes,
  volumeDosEfeitos,
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

describe('preferências do som', () => {
  beforeEach(() => localStorage.clear());

  it('deveComecarLigadoECadaVolumeEmCinquenta', () => {
    expect(somLigado.obter()).toBe(true);
    expect(volumeDaMusica.obter()).toBe(INICIAL);
    expect(volumeDosEfeitos.obter()).toBe(INICIAL);
    expect(volumeDasReacoes.obter()).toBe(INICIAL);
  });

  it('deveLerAsChavesQueQuemJaJogouTemGravadas', () => {
    localStorage.setItem('fodinha:som', 'off');
    localStorage.setItem('fodinha:volume-musica', '20');
    localStorage.setItem('fodinha:volume-efeitos', '80');
    localStorage.setItem('fodinha:volume-reacoes', 'lixo');
    expect(somLigado.obter()).toBe(false);
    expect(volumeDaMusica.obter()).toBe(20);
    expect(volumeDosEfeitos.obter()).toBe(80);
    expect(volumeDasReacoes.obter()).toBe(INICIAL);
  });

  it('deveGravarSoOMudoEOVolumeNormalizado', () => {
    somLigado.definir(false);
    expect(localStorage.getItem('fodinha:som')).toBe('off');
    somLigado.definir(true);
    expect(localStorage.getItem('fodinha:som')).toBeNull();
    volumeDaMusica.definir(250);
    expect(localStorage.getItem('fodinha:volume-musica')).toBe(String(VOLUME_MAXIMO));
    expect(volumeDaMusica.obter()).toBe(VOLUME_MAXIMO);
  });
});
