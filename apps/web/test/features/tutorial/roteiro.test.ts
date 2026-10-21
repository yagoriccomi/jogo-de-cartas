import { ehCartaOculta } from '@fodinha/shared';
import { describe, expect, it, vi } from 'vitest';
import { ID_VOCE, type Momento } from '../../../src/features/tutorial/mesaDoTutorial';
import { montarRoteiro, type Passo } from '../../../src/features/tutorial/roteiro';

// O roteiro escolhe "toque"/"clique" pelo aparelho; no node não há `window`.
vi.mock('../../../src/features/tutorial/ponteiro', () => ({
  usaToque: () => false,
  verboDeToque: () => 'Clique',
}));

/**
 * O roteiro descreve à mão os estados que o servidor mandaria e não recalcula regra. Estes testes
 * conferem que cada momento continua possível: se uma mudança de regra ou um ajuste no texto
 * deixar o tutorial ensinando algo que o jogo de verdade não faria, eles falham.
 */
const roteiro = montarRoteiro('Você');
const rodadaEmJogo = (m: Momento) => m.fase === 'palpites' || m.fase === 'jogando';
const vazasFechadas = (m: Momento) =>
  m.jogadores.reduce((soma, jogador) => soma + jogador.vazasGanhas.length, 0);
const somaDosPalpites = (m: Momento, menos: string) =>
  m.jogadores.filter((j) => j.id !== menos).reduce((soma, j) => soma + (j.palpite ?? 0), 0);

function descrever(passo: Passo, indice: number): string {
  return `passo ${indice + 1} (${passo.balao?.titulo ?? passo.balao?.texto ?? 'sem balão'})`;
}

describe('roteiro do tutorial', () => {
  it('deveTerPassos', () => {
    expect(roteiro.length).toBeGreaterThan(0);
  });

  it('deveDarACadaJogadorAsCartasQueAindaFaltamJogarNaRodada', () => {
    roteiro.forEach((passo, indice) => {
      const m = passo.momento;
      if (!rodadaEmJogo(m)) return;
      for (const jogador of m.jogadores) {
        const naMesa = m.mesa.some((jogada) => jogada.jogadorId === jogador.id) ? 1 : 0;
        expect(jogador.mao.length, `${jogador.id} no ${descrever(passo, indice)}`).toBe(
          m.rodada.cartas - vazasFechadas(m) - naMesa,
        );
      }
    });
  });

  it('naoDeveRepetirCartaEntreMaosEMesa', () => {
    roteiro.forEach((passo, indice) => {
      const m = passo.momento;
      const ids = [
        ...m.jogadores.flatMap((jogador) => jogador.mao.map((carta) => carta.id)),
        ...m.mesa.map((jogada) => jogada.carta.id),
      ];
      expect(new Set(ids).size, descrever(passo, indice)).toBe(ids.length);
    });
  });

  it('deveTerNoMaximoUmaJogadaPorJogadorNaMesa', () => {
    roteiro.forEach((passo, indice) => {
      const jogadores = passo.momento.mesa.map((jogada) => jogada.jogadorId);
      expect(new Set(jogadores).size, descrever(passo, indice)).toBe(jogadores.length);
    });
  });

  it('deveEsconderSoAMinhaCartaNaRodadaCega', () => {
    for (const { momento: m } of roteiro) {
      const cega = m.rodada.cartas === 1;
      const eu = m.jogadores.find((jogador) => jogador.id === ID_VOCE);
      for (const carta of eu?.mao ?? []) expect(ehCartaOculta(carta)).toBe(cega);
      if (!cega || !rodadaEmJogo(m)) continue;
      for (const outro of m.jogadores.filter((jogador) => jogador.id !== ID_VOCE)) {
        if (outro.mao.length > 0) expect(outro.testa).not.toBeNull();
      }
    }
  });

  it('deveProibirAoPeSoONumeroQueFechariaASoma', () => {
    roteiro.forEach((passo, indice) => {
      const m = passo.momento;
      const minhaVezDePalpitarComoPe =
        m.fase === 'palpites' && m.idDaVez === ID_VOCE && m.rodada.idDoPe === ID_VOCE;
      if (minhaVezDePalpitarComoPe) {
        const proibido = m.rodada.cartas - somaDosPalpites(m, ID_VOCE);
        expect(m.palpiteProibido, descrever(passo, indice)).toBe(proibido >= 0 ? proibido : null);
        return;
      }
      // O servidor só manda o número proibido para o pé, na fase de palpites.
      if (m.fase !== 'palpites' || m.rodada.idDoPe !== ID_VOCE) {
        expect(m.palpiteProibido, descrever(passo, indice)).toBeNull();
      }
    });
  });

  it('deveEsperarSoJogadasQueOJogoAceitaria', () => {
    roteiro.forEach((passo, indice) => {
      const { espera, momento: m } = passo;
      const onde = descrever(passo, indice);
      if (espera.tipo === 'palpite') {
        expect(m.fase, onde).toBe('palpites');
        expect(m.idDaVez, onde).toBe(ID_VOCE);
        expect(espera.valor, onde).toBeGreaterThanOrEqual(0);
        expect(espera.valor, onde).toBeLessThanOrEqual(m.rodada.cartas);
        expect(espera.valor, onde).not.toBe(m.palpiteProibido);
      }
      if (espera.tipo === 'jogar') {
        const eu = m.jogadores.find((jogador) => jogador.id === ID_VOCE);
        expect(m.fase, onde).toBe('jogando');
        expect(m.idDaVez, onde).toBe(ID_VOCE);
        expect(
          eu?.mao.map((carta) => carta.id),
          onde,
        ).toContain(espera.carta.id);
      }
    });
  });

  it('deveFecharARodadaComOResultadoQueAsRegrasDariam', () => {
    roteiro.forEach((passo, indice) => {
      const m = passo.momento;
      if (m.resultadoRodada === null) return;
      const inicioDaRodada = roteiro.find(({ momento }) => momento.rodada === m.rodada)?.momento;
      for (const resultado of m.resultadoRodada) {
        const jogador = m.jogadores.find((j) => j.id === resultado.jogadorId);
        const antes = inicioDaRodada?.jogadores.find((j) => j.id === resultado.jogadorId);
        const onde = `${resultado.jogadorId} no ${descrever(passo, indice)}`;
        expect(resultado.palpite, onde).toBe(jogador?.palpite);
        expect(resultado.vazasFeitas, onde).toBe(jogador?.vazasGanhas.length);
        expect(resultado.vidasPerdidas, onde).toBe(
          Math.abs(resultado.palpite - resultado.vazasFeitas),
        );
        expect(jogador?.vidas, onde).toBe((antes?.vidas ?? 0) - resultado.vidasPerdidas);
      }
    });
  });

  it('deveTerAVersaoRapidaSemPassoOpcionalQueEspereJogada', () => {
    for (const passo of roteiro.filter((p) => p.opcional)) {
      expect(passo.espera.tipo).toBe('botao');
    }
  });
});
