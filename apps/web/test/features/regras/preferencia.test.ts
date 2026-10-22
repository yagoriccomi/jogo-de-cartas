import { beforeEach, describe, expect, it } from 'vitest';
import { dispensarResumo, resumoDispensado } from '../../../src/features/regras/preferencia';

const CHAVE_DO_RESUMO = 'fodinha:resumo-das-regras';

describe('resumo das regras', () => {
  beforeEach(() => localStorage.clear());

  it('deveAbrirAteOJogadorDispensar', () => {
    expect(resumoDispensado()).toBe(false);
    dispensarResumo();
    expect(resumoDispensado()).toBe(true);
  });

  it('deveManterAChaveEOValorQueQuemJaDispensouTemGravados', () => {
    localStorage.setItem(CHAVE_DO_RESUMO, 'dispensado');
    expect(resumoDispensado()).toBe(true);
    localStorage.clear();
    dispensarResumo();
    expect(localStorage.getItem(CHAVE_DO_RESUMO)).toBe('dispensado');
  });
});
