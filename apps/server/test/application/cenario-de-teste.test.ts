import { CONFIGURACAO_PADRAO, LIMITES } from '@fodinha/shared';
import { describe, expect, it } from 'vitest';
import { ator, montarCenario } from '../apoio';

const dados = { apelido: 'Teste', dispositivoId: 'disp-teste', jogadores: 10, cartas: 13 };

describe('ServicoDeSalas — criarCenario', () => {
  it('deveCriarSalaCom1HumanoE9BotsJaEmPartidaComAsCartasPedidas', () => {
    const { servico, salaDe, partidaDe } = montarCenario();

    const sessao = servico.criarCenario(dados);

    const sala = salaDe(ator(sessao));
    expect(sala?.participantes).toHaveLength(10);
    expect(sala?.participantes.filter((p) => p.ehBot)).toHaveLength(9);
    expect(sala?.participantes.find((p) => p.id === sessao.jogadorId)?.ehAnfitriao).toBe(true);
    expect(sala?.configuracao).toEqual({
      quantidadeBaralhos: LIMITES.maxBaralhos,
      vidasIniciais: LIMITES.maxVidas,
      incluirOitoNoveDez: false,
      mortosVeemCartas: false,
      prazoDaVezSegundos: CONFIGURACAO_PADRAO.prazoDaVezSegundos,
    });
    expect(sala?.emPartida).toBe(true);
    const jogo = partidaDe(ator(sessao));
    expect(jogo?.cartasPorJogador).toBe(13);
    expect(jogo?.minhaMao).toHaveLength(13);
  });

  it('deveLimitarAsCartasAoMaximoPossivel', () => {
    const { servico, partidaDe } = montarCenario();

    const sessao = servico.criarCenario({ ...dados, cartas: 50 });

    // floor((160 - 1) / 10) com 4 baralhos de 40 cartas e 10 jogadores.
    expect(partidaDe(ator(sessao))?.cartasPorJogador).toBe(15);
  });

  it('deveRejeitarQuantidadesInvalidas', () => {
    const { servico } = montarCenario();

    for (const invalido of [
      { jogadores: 1 },
      { jogadores: 11 },
      { jogadores: 2.5 },
      { cartas: 0 },
      { cartas: '3' },
    ]) {
      expect(() => servico.criarCenario({ ...dados, ...invalido })).toThrow();
    }
  });

  it('deveManterOLimiteNormalDeBotsNasSalasComuns', () => {
    const { servico, criarSala } = montarCenario();
    const sessao = criarSala();

    for (let i = 0; i < LIMITES.maxBots; i++) servico.adicionarBot(ator(sessao));

    expect(() => servico.adicionarBot(ator(sessao))).toThrow();
  });
});
