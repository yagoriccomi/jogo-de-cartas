import { describe, expect, it } from 'vitest';
import { formatarDuracao } from '../../../src/features/mesa/tempo';

describe('formatarDuracao', () => {
  it.each([
    [0, '0:00'],
    [999, '0:00'],
    [24_000, '0:24'],
    [60_000, '1:00'],
    [65_500, '1:05'],
    [120_000, '2:00'],
  ])('deveFormatar %i ms como %s', (ms, esperado) => {
    expect(formatarDuracao(ms)).toBe(esperado);
  });

  it('deveMostrarZeroQuandoOPrazoJaPassou', () => {
    expect(formatarDuracao(-3_000)).toBe('0:00');
  });
});
