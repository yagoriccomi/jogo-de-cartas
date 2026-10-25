import { LIMITES } from '@fodinha/shared';
import { describe, expect, it } from 'vitest';
import { lerRetornoDoLogin } from '../../../src/features/login/retorno';

describe('volta do login no fragmento do endereço', () => {
  it('sem fragmento do login não há volta', () => {
    expect(lerRetornoDoLogin('')).toBeNull();
    expect(lerRetornoDoLogin('#')).toBeNull();
    expect(lerRetornoDoLogin('#outra=coisa')).toBeNull();
  });

  it('lê o código de uso único', () => {
    expect(lerRetornoDoLogin('#login=abc123')).toEqual({ tipo: 'codigo', codigo: 'abc123' });
    expect(lerRetornoDoLogin('login=a%2Bb')).toEqual({ tipo: 'codigo', codigo: 'a+b' });
  });

  it('falha explícita, código vazio ou grande demais viram falha', () => {
    expect(lerRetornoDoLogin('#login-falhou')).toEqual({ tipo: 'falha' });
    expect(lerRetornoDoLogin('#login=')).toEqual({ tipo: 'falha' });
    expect(lerRetornoDoLogin(`#login=${'x'.repeat(LIMITES.maxTokenDeLogin + 1)}`)).toEqual({
      tipo: 'falha',
    });
  });
});
