import { describe, expect, it } from 'vitest';
import { calcularLeque } from '../../../src/features/mesa/leque';

/** Larguras dos testes de tela: celular baixo, iPhone, Android grande, notebook e monitor. */
const LARGURAS_DO_CELULAR = [360, 375, 430];
const LARGURAS_DO_COMPUTADOR = [1366, 1920];
/** A mão ocupa no máximo 30% da tela (FRACAO_DA_TELA_PARA_A_MAO). */
const fracaoDaTela = (altura: number) => Math.floor(altura * 0.3);
const TOLERANCIA_PX = 0.01;
const MAIOR_MAO = 60;

const QUANTIDADES = Array.from({ length: MAIOR_MAO }, (_, i) => i + 1);

describe('calcularLeque', () => {
  it('deveCaberSempreNaLarguraDisponivelEmQualquerTamanhoDeMao', () => {
    const casos = [
      ...LARGURAS_DO_CELULAR.map((largura) => ({ largura, computador: false })),
      ...LARGURAS_DO_COMPUTADOR.map((largura) => ({ largura, computador: true })),
    ];
    for (const { largura, computador } of casos) {
      for (const quantidade of QUANTIDADES) {
        const leque = calcularLeque({ quantidade, larguraDisponivel: largura, computador });
        expect(leque.larguraTotal, `${quantidade} cartas em ${largura}px`).toBeLessThanOrEqual(
          largura + TOLERANCIA_PX,
        );
        for (const posicao of leque.posicoes) {
          expect(posicao.esquerda + leque.larguraCarta).toBeLessThanOrEqual(
            leque.larguraTotal + TOLERANCIA_PX,
          );
        }
      }
    }
  });

  it('deveTerUmaPosicaoPorCartaNaOrdemRecebida', () => {
    const leque = calcularLeque({ quantidade: 25, larguraDisponivel: 375, computador: false });
    expect(leque.posicoes).toHaveLength(25);
    const topos = leque.posicoes.map((posicao) => posicao.topo);
    expect(topos).toEqual([...topos].sort((a, b) => a - b));
    expect(leque.posicoes[0]?.esquerda).toBeLessThan(leque.posicoes[1]?.esquerda ?? 0);
  });

  it('deveDividirAsFileirasDeFormaEquilibrada', () => {
    const leque = calcularLeque({ quantidade: 21, larguraDisponivel: 1920, computador: true });
    expect(leque.fileiras).toBe(2);
    expect(leque.porFileira).toBe(11);
  });

  it('deveDeixarUmaCartaSozinhaRetaESemPasso', () => {
    const leque = calcularLeque({ quantidade: 1, larguraDisponivel: 375, computador: false });
    expect(leque.passo).toBe(0);
    expect(leque.fileiras).toBe(1);
    expect(leque.posicoes[0]?.rotacao).toBe(0);
  });

  it('deveInclinarAsPontasDeFormaSimetrica', () => {
    const leque = calcularLeque({ quantidade: 7, larguraDisponivel: 1366, computador: true });
    const primeira = leque.posicoes[0];
    const ultima = leque.posicoes[6];
    expect(primeira?.rotacao).toBeCloseTo(-(ultima?.rotacao ?? 0));
    expect(primeira?.deslocamentoY).toBeCloseTo(ultima?.deslocamentoY ?? 0);
  });

  it('deveUsarALarguraPadraoEnquantoOElementoNaoFoiMedido', () => {
    const semMedida = calcularLeque({ quantidade: 13, larguraDisponivel: 0, computador: false });
    const padrao = calcularLeque({ quantidade: 13, larguraDisponivel: 360, computador: false });
    expect(semMedida).toEqual(padrao);
  });

  it('deveEncolherACartaParaCaberEm30PorCentoDaTelaNaRodadaDe13Cartas', () => {
    const alturaMaxima = fracaoDaTela(812);
    const livre = calcularLeque({ quantidade: 13, larguraDisponivel: 375, computador: false });
    const limitado = calcularLeque({
      quantidade: 13,
      larguraDisponivel: 375,
      computador: false,
      alturaMaxima,
    });
    expect(limitado.alturaTotal).toBeLessThanOrEqual(alturaMaxima);
    expect(limitado.larguraCarta).toBeLessThanOrEqual(livre.larguraCarta);
  });

  it('naoDeveEncolherQuandoJaCabeNaAltura', () => {
    const livre = calcularLeque({ quantidade: 5, larguraDisponivel: 1920, computador: true });
    const limitado = calcularLeque({
      quantidade: 5,
      larguraDisponivel: 1920,
      computador: true,
      alturaMaxima: fracaoDaTela(1080),
    });
    expect(limitado).toEqual(livre);
  });

  it('deveCompactarAsRodadasDe39CartasOuMaisSemDeixarACartaIlegivel', () => {
    const LARGURA_COMPACTA_NO_CELULAR = 44;
    const leque = calcularLeque({
      quantidade: 59,
      larguraDisponivel: 360,
      computador: false,
      alturaMaxima: fracaoDaTela(640),
    });
    expect(leque.larguraCarta).toBeGreaterThanOrEqual(LARGURA_COMPACTA_NO_CELULAR);
    expect(leque.posicoes).toHaveLength(59);
    expect(leque.densa).toBe(true);
  });
});
