import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { declararMarcaDoAparelho, declararPreferencia } from '../../src/lib/preferencia';

const PADRAO = 50;

function declararNumero(chave: string, opcoes: { apagarSeInvalido?: boolean } = {}) {
  return declararPreferencia<number>({
    chave,
    padrao: PADRAO,
    decodificar: (bruto) => {
      const numero = Number(bruto);
      return bruto.trim() !== '' && Number.isFinite(numero) ? Math.round(numero) : null;
    },
    codificar: (valor) => String(valor),
    ...opcoes,
  });
}

/** Armazenamento que recusa tudo, como o de uma aba privada bloqueada. */
function armazenamentoQueFalha(falhar: { leitura: boolean; escrita: boolean }): Storage {
  const real = localStorage;
  const erro = (): never => {
    throw new Error('bloqueado');
  };
  return {
    get length() {
      return real.length;
    },
    clear: () => real.clear(),
    key: (indice) => real.key(indice),
    getItem: (chave) => (falhar.leitura ? erro() : real.getItem(chave)),
    setItem: (chave, valor) => (falhar.escrita ? erro() : real.setItem(chave, valor)),
    removeItem: (chave) => (falhar.escrita ? erro() : real.removeItem(chave)),
  };
}

const ARMAZENAMENTO_REAL = localStorage;
let chaveDoTeste = 0;
const novaChave = (): string => `teste:preferencia-${(chaveDoTeste += 1)}`;

describe('declararPreferencia', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    globalThis.localStorage = ARMAZENAMENTO_REAL;
    vi.restoreAllMocks();
  });

  it('deveDevolverOPadraoSemNadaGravado', () => {
    expect(declararNumero(novaChave()).obter()).toBe(PADRAO);
  });

  it('deveGravarNaChaveDeclaradaELerDeVolta', () => {
    const chave = novaChave();
    const preferencia = declararNumero(chave);
    preferencia.definir(30);
    expect(localStorage.getItem(chave)).toBe('30');
    expect(preferencia.obter()).toBe(30);
  });

  it('deveLerOQueJaEstavaGravadoAntes', () => {
    const chave = novaChave();
    localStorage.setItem(chave, '70');
    expect(declararNumero(chave).obter()).toBe(70);
  });

  it('deveVoltarAoPadraoComValorInvalidoGravado', () => {
    const chave = novaChave();
    localStorage.setItem(chave, 'alto');
    expect(declararNumero(chave).obter()).toBe(PADRAO);
    expect(localStorage.getItem(chave)).toBe('alto');
  });

  it('deveApagarOInvalidoQuandoDeclarado', () => {
    const chave = novaChave();
    localStorage.setItem(chave, 'alto');
    expect(declararNumero(chave, { apagarSeInvalido: true }).obter()).toBe(PADRAO);
    expect(localStorage.getItem(chave)).toBeNull();
  });

  it('deveGuardarOValorNormalizadoPelaPropriaDeclaracao', () => {
    const preferencia = declararNumero(novaChave());
    preferencia.definir(33.6);
    expect(preferencia.obter()).toBe(34);
  });

  it('deveApagarAChaveQuandoACodificacaoDaNulo', () => {
    const chave = novaChave();
    const marca = declararMarcaDoAparelho(chave, 'feito');
    marca.definir(true);
    expect(localStorage.getItem(chave)).toBe('feito');
    marca.definir(false);
    expect(localStorage.getItem(chave)).toBeNull();
  });

  it('deveDevolverOMesmoObjetoEnquantoOTextoGravadoNaoMuda', () => {
    const chave = novaChave();
    const preferencia = declararPreferencia<{ n: number } | null>({
      chave,
      padrao: null,
      decodificar: (bruto) => JSON.parse(bruto) as { n: number },
      codificar: (valor) => (valor === null ? null : JSON.stringify(valor)),
    });
    localStorage.setItem(chave, '{"n":1}');
    expect(preferencia.obter()).toBe(preferencia.obter());
  });

  it('deveAvisarQuemAssinouACadaMudancaAteCancelar', () => {
    const preferencia = declararNumero(novaChave());
    const ouvinte = vi.fn();
    const cancelar = preferencia.assinar(ouvinte);
    preferencia.definir(10);
    expect(ouvinte).toHaveBeenCalledTimes(1);
    cancelar();
    preferencia.definir(20);
    expect(ouvinte).toHaveBeenCalledTimes(1);
  });

  it('deveFuncionarNaMemoriaQuandoOArmazenamentoFalhaEAvisarUmaVez', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    globalThis.localStorage = armazenamentoQueFalha({ leitura: true, escrita: true });
    const preferencia = declararNumero(novaChave());

    expect(preferencia.obter()).toBe(PADRAO);
    preferencia.definir(20);
    preferencia.definir(25);
    expect(preferencia.obter()).toBe(25);
    preferencia.obter();

    const eventos = aviso.mock.calls.map(
      ([linha]) => (JSON.parse(String(linha)) as { evento: string }).evento,
    );
    expect(eventos).toEqual(['storage.leitura_falhou', 'storage.escrita_falhou']);
  });

  it('deveManterOValorDaMemoriaQuandoSoAEscritaFalha', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const chave = novaChave();
    localStorage.setItem(chave, '70');
    globalThis.localStorage = armazenamentoQueFalha({ leitura: false, escrita: true });
    const preferencia = declararNumero(chave);

    preferencia.definir(20);
    expect(preferencia.obter()).toBe(20);
  });
});

describe('declararMarcaDoAparelho', () => {
  beforeEach(() => localStorage.clear());

  it('deveComecarDesmarcadaEFicarMarcadaNoAparelho', () => {
    const chave = novaChave();
    expect(declararMarcaDoAparelho(chave, 'feito').obter()).toBe(false);
    declararMarcaDoAparelho(chave, 'feito').definir(true);
    expect(declararMarcaDoAparelho(chave, 'feito').obter()).toBe(true);
  });

  it('deveIgnorarOutroTextoGravadoNaChave', () => {
    const chave = novaChave();
    localStorage.setItem(chave, 'talvez');
    expect(declararMarcaDoAparelho(chave, 'feito').obter()).toBe(false);
  });
});
