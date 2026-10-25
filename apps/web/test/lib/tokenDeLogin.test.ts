import { LIMITES } from '@fodinha/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  esquecerTokenDeLogin,
  lerTokenDeLogin,
  salvarTokenDeLogin,
} from '../../src/lib/tokenDeLogin';

const CHAVE = 'fodinha:login';

describe('token do login no aparelho', () => {
  beforeEach(() => localStorage.clear());

  it('guarda, devolve e esquece', () => {
    expect(lerTokenDeLogin()).toBeNull();
    salvarTokenDeLogin('token-1');
    expect(localStorage.getItem(CHAVE)).toBe('token-1');
    expect(lerTokenDeLogin()).toBe('token-1');
    esquecerTokenDeLogin();
    expect(lerTokenDeLogin()).toBeNull();
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it('conteúdo fora do limite é descartado', () => {
    localStorage.setItem(CHAVE, 'x'.repeat(LIMITES.maxTokenDeLogin + 1));
    expect(lerTokenDeLogin()).toBeNull();
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });
});
