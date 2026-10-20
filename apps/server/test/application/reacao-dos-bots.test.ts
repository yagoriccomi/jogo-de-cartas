import { REACOES } from '@fodinha/shared';
import { describe, expect, it } from 'vitest';
import { ATRASO_BOT_MS, PRAZO_MS, ator, montarCenario } from '../apoio';

/** Sorteio que sempre cai na chance de reação (e sempre escolhe a primeira da lista). */
const BOTS_FALANTES = (): number => 0;

/** Rodadas bastantes para o bot jogar cartas, não só palpitar. */
const PASSOS_DE_JOGO = 12;

function mesaDaAnaComBot(sorteio: () => number) {
  const c = montarCenario({}, sorteio);
  const ana = c.criarSala();
  c.servico.adicionarBot(ator(ana));
  c.servico.iniciarPartida(ator(ana));
  for (let i = 0; i < PASSOS_DE_JOGO; i++) {
    c.humanosJogam([ana]);
    c.relogio.avancar(ATRASO_BOT_MS);
  }
  const botId = c.partidaDe(ana)?.jogadores.find((j) => j.ehBot)?.id;
  return { c, ana, botId };
}

describe('reação dos bots', () => {
  it('deveMandarReacaoDoBotSoParaOsHumanosQuandoOSorteioCaiNaChance', () => {
    const { c, ana, botId } = mesaDaAnaComBot(BOTS_FALANTES);
    expect(c.notificador.reacoes.length).toBeGreaterThan(0);
    for (const { destinatarios, reacao } of c.notificador.reacoes) {
      expect(reacao.jogadorId).toBe(botId);
      expect(reacao.reacao).toBe(REACOES[0]);
      expect(destinatarios).toEqual([ana.jogadorId]);
    }
  });

  it('deveFicarCaladoQuandoOSorteioNaoCaiNaChance', () => {
    const { c } = mesaDaAnaComBot(() => 1);
    expect(c.notificador.reacoes).toHaveLength(0);
  });

  it('naoDeveReagirPorHumanoQueEstourouOPrazo', () => {
    const c = montarCenario({}, BOTS_FALANTES);
    const ana = c.criarSala();
    c.entrar(ana, 'Bia');
    c.servico.iniciarPartida(ator(ana));
    for (let i = 0; i < PASSOS_DE_JOGO; i++) c.relogio.avancar(PRAZO_MS);
    expect(c.notificador.reacoes).toHaveLength(0);
  });

  it('deveFazerTodosOsBotsReagiremQuandoUmHumanoEstouraOPrazo', () => {
    // Acima da chance: calados no sorteio comum, então só o estouro de prazo os faz reagir.
    const c = montarCenario({}, () => 0.5);
    const ana = c.criarSala();
    c.servico.adicionarBot(ator(ana));
    c.servico.adicionarBot(ator(ana));
    c.servico.iniciarPartida(ator(ana));
    for (let i = 0; i < PASSOS_DE_JOGO && c.notificador.reacoes.length === 0; i++) {
      c.relogio.avancar(ATRASO_BOT_MS);
      c.relogio.avancar(PRAZO_MS);
    }
    const quemReagiu = new Set(c.notificador.reacoes.map(({ reacao }) => reacao.jogadorId));
    expect(quemReagiu.size).toBe(2);
    expect(quemReagiu.has(ana.jogadorId)).toBe(false);
  });
});
