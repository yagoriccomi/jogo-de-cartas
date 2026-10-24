import { describe, expect, it } from 'vitest';
import { lerAmbiente, lerBancoDoHistorico } from '../../src/infrastructure/ambiente';

describe('Banco do histórico no ambiente', () => {
  it('sem TURSO_DATABASE_URL (ou vazia) o histórico fica desligado', () => {
    expect(lerAmbiente({}).historico).toBeNull();
    expect(lerBancoDoHistorico({ TURSO_DATABASE_URL: '  ', TURSO_AUTH_TOKEN: 'x' })).toBeNull();
  });

  it('arquivo local dispensa token; Turso leva o token junto', () => {
    expect(lerBancoDoHistorico({ TURSO_DATABASE_URL: 'file:./dados/fodinha.db' })).toEqual({
      url: 'file:./dados/fodinha.db',
      tokenDeAcesso: null,
    });
    expect(
      lerBancoDoHistorico({
        TURSO_DATABASE_URL: 'libsql://fodinha.turso.io',
        TURSO_AUTH_TOKEN: 'segredo',
      }),
    ).toEqual({ url: 'libsql://fodinha.turso.io', tokenDeAcesso: 'segredo' });
  });

  it('a URL informada na linha de comando vence a do ambiente', () => {
    expect(
      lerBancoDoHistorico({ TURSO_DATABASE_URL: 'libsql://outro.turso.io' }, 'file::memory:'),
    ).toEqual({ url: 'file::memory:', tokenDeAcesso: null });
  });

  it('esquema desconhecido derruba a subida sem repetir a URL no erro', () => {
    expect(() =>
      lerBancoDoHistorico({ TURSO_DATABASE_URL: 'postgres://usuario:senha@host/banco' }),
    ).toThrow(/^(?!.*senha).*TURSO_DATABASE_URL inválida/);
  });
});
