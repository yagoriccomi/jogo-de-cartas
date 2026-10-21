import { NAIPES } from '@fodinha/shared';
import { describe, expect, it } from 'vitest';
import { caminhoDoNaipe, caminhoDoTexto } from '../../../src/features/mesa/pixel';

describe('pixel', () => {
  it('deveDesenharValoresDiferentesComCaminhosDiferentes', () => {
    // 2, 3 e 8 são os que se confundem em tamanho pequeno.
    const caminhos = ['2', '3', '8', 'A', 'K', 'Q', 'J', '10'].map(caminhoDoTexto);
    expect(new Set(caminhos).size).toBe(caminhos.length);
    for (const caminho of caminhos) expect(caminho).not.toBe('');
  });

  it('deveIgnorarCaracteresSemGlifo', () => {
    expect(caminhoDoTexto('')).toBe('');
    expect(caminhoDoTexto('§')).toBe('');
    expect(caminhoDoTexto('§A')).toBe(caminhoDoTexto('A'));
  });

  it('deveDesenharCadaNaipeDeUmJeito', () => {
    const caminhos = NAIPES.map(caminhoDoNaipe);
    expect(new Set(caminhos).size).toBe(NAIPES.length);
  });
});
