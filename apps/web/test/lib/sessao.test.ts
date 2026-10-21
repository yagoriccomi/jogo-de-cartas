import { LIMITES } from '@fodinha/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { lerSessao, limparSessao, obterDispositivoId, salvarSessao } from '../../src/lib/sessao';

const CHAVE_SESSAO = 'fodinha:sessao';
const SESSAO = { codigoSala: 'ABCD', jogadorId: 'j1', tokenSessao: 't1' };

describe('sessao', () => {
  beforeEach(() => localStorage.clear());

  it('deveDevolverASessaoSalva', () => {
    salvarSessao(SESSAO);
    expect(lerSessao()).toEqual(SESSAO);
  });

  it('deveDevolverNuloSemSessaoOuDepoisDeLimpar', () => {
    expect(lerSessao()).toBeNull();
    salvarSessao(SESSAO);
    limparSessao();
    expect(lerSessao()).toBeNull();
  });

  it('deveRecusarSessaoComFormatoErrado', () => {
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify({ codigoSala: 'ABCD', jogadorId: 1 }));
    expect(lerSessao()).toBeNull();
  });

  it('deveApagarConteudoCorrompidoParaNaoRepetirOErro', () => {
    localStorage.setItem(CHAVE_SESSAO, '{quebrado');
    expect(lerSessao()).toBeNull();
    expect(localStorage.getItem(CHAVE_SESSAO)).toBeNull();
  });

  it('deveGerarUmDispositivoValidoEMantelEstavel', () => {
    const id = obterDispositivoId();
    expect(id.length).toBeGreaterThan(0);
    expect(id.length).toBeLessThanOrEqual(LIMITES.maxIdentificador);
    expect(obterDispositivoId()).toBe(id);
  });
});
