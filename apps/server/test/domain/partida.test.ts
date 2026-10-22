import {
  CONFIGURACAO_PADRAO,
  ehCartaOculta,
  valoresEmJogo,
  type Carta,
  type Valor,
} from '@fodinha/shared';
import { describe, expect, it } from 'vitest';
import { EstrategiaDoBot } from '../../src/domain/estrategia-bot';
import { forcaDaCarta } from '../../src/domain/forca';
import { Partida } from '../../src/domain/partida';
import { BOT_SEM_ERRO, geradorComSemente } from '../apoio';

const estrategia = new EstrategiaDoBot(BOT_SEM_ERRO);

function novaPartida(jogadores = 4, semente = 42, configuracao = CONFIGURACAO_PADRAO): Partida {
  const jogadorIds = Array.from({ length: jogadores }, (_, i) => `j${i}`);
  return Partida.iniciar({ configuracao, jogadorIds, gerarAleatorio: geradorComSemente(semente) });
}

/** Executa uma ação (palpite ou carta) pelo jogador da vez usando a estratégia do bot. */
function avancar(partida: Partida): void {
  if (partida.faseAtual === 'fim_de_rodada') {
    partida.iniciarProximaRodada();
    return;
  }
  const id = partida.idDaVez as string;
  const visao = partida.visaoPara(id);
  if (partida.faseAtual === 'palpites') {
    partida.palpitar(id, estrategia.escolherPalpite(visao, id, partida.palpitesPermitidos(id)));
    return;
  }
  partida.jogarCarta(id, estrategia.escolherCarta(visao, id));
}

function palpitarTodos(partida: Partida): void {
  while (partida.faseAtual === 'palpites') avancar(partida);
}

function jogarAteFimDaRodada(partida: Partida): void {
  while (partida.faseAtual === 'palpites' || partida.faseAtual === 'jogando') avancar(partida);
}

describe('Partida', () => {
  it('deveComecarComUmaCartaPorJogadorEmRodadaCega', () => {
    const partida = novaPartida();
    const visao = partida.visaoPara('j0');
    expect(visao.numeroRodada).toBe(1);
    expect(visao.cartasPorJogador).toBe(1);
    expect(visao.rodadaCega).toBe(true);
    expect(visao.fase).toBe('palpites');
    expect(visao.vira).not.toBeNull();
  });

  it('deveEsconderAPropriaCartaEMostrarADosOutrosNaRodadaCega', () => {
    const visao = novaPartida().visaoPara('j0');
    expect(visao.minhaMao).toHaveLength(1);
    expect(visao.minhaMao.every(ehCartaOculta)).toBe(true);
    expect(visao.jogadores.find((j) => j.id === 'j0')?.cartaNaTesta).toBeNull();
    expect(visao.jogadores.filter((j) => j.id !== 'j0').every((j) => j.cartaNaTesta !== null)).toBe(
      true,
    );
  });

  it('naoDeveRevelarMaosAlheiasForaDaRodadaCega', () => {
    const partida = novaPartida();
    jogarAteFimDaRodada(partida);
    partida.iniciarProximaRodada();

    const visao = partida.visaoPara('j0');
    expect(visao.cartasPorJogador).toBe(2);
    expect(visao.minhaMao.some(ehCartaOculta)).toBe(false);
    expect(visao.jogadores.every((j) => j.cartaNaTesta === null)).toBe(true);
    const idsAlheios = new Set(partida.cartasNaMaoDe('j1').map((c) => c.id));
    expect(visao.minhaMao.some((c) => idsAlheios.has(c.id))).toBe(false);
  });

  it('deveRecusarPalpiteForaDaVez', () => {
    const partida = novaPartida();
    const foraDaVez = ['j0', 'j1', 'j2', 'j3'].find((id) => id !== partida.idDaVez) as string;
    expect(() => partida.palpitar(foraDaVez, 0)).toThrow(
      expect.objectContaining({ codigo: 'FORA_DA_VEZ' }),
    );
  });

  it('deveImpedirOPeDeFecharASomaDosPalpites', () => {
    const partida = novaPartida();
    while (partida.idDaVez !== partida.visaoPara(null).idDoPe) {
      partida.palpitar(partida.idDaVez as string, 0);
    }
    const pe = partida.idDaVez as string;
    expect(partida.visaoPara(pe).palpiteProibido).toBe(1);
    expect(partida.palpitesPermitidos(pe)).toEqual([0]);
    expect(() => partida.palpitar(pe, 1)).toThrow(
      expect.objectContaining({ codigo: 'PALPITE_INVALIDO' }),
    );
  });

  it('deveRecusarCartaQueNaoEstaNaMao', () => {
    const partida = novaPartida();
    palpitarTodos(partida);
    expect(() => partida.jogarCarta(partida.idDaVez as string, 'carta-inexistente')).toThrow(
      expect.objectContaining({ codigo: 'JOGADA_INVALIDA' }),
    );
  });

  it('deveDescontarVidasPelaDiferencaEntrePalpiteEVazas', () => {
    const partida = novaPartida();
    jogarAteFimDaRodada(partida);
    const visao = partida.visaoPara(null);
    expect(visao.fase).toBe('fim_de_rodada');
    for (const resultado of visao.resultadoRodada ?? []) {
      const jogador = visao.jogadores.find((j) => j.id === resultado.jogadorId);
      expect(resultado.vidasPerdidas).toBe(Math.abs(resultado.palpite - resultado.vazasFeitas));
      expect(jogador?.vidas).toBe(CONFIGURACAO_PADRAO.vidasIniciais - resultado.vidasPerdidas);
    }
    const totalDeVazas = (visao.resultadoRodada ?? []).reduce((soma, r) => soma + r.vazasFeitas, 0);
    expect(totalDeVazas).toBeLessThanOrEqual(1);
  });

  it('deveProgredirAsCartasAteOMaximoEVoltarParaUm', () => {
    const partida = novaPartida(10, 7);
    const sequencia: number[] = [];
    for (let rodada = 0; rodada < 5 && partida.faseAtual !== 'encerrada'; rodada++) {
      sequencia.push(partida.visaoPara(null).cartasPorJogador);
      jogarAteFimDaRodada(partida);
      if (partida.faseAtual === 'fim_de_rodada') partida.iniciarProximaRodada();
    }
    // 10 jogadores com 40 cartas: máximo de 3 (uma carta reservada para a vira).
    expect(sequencia.slice(0, 4)).toEqual([1, 2, 3, 1]);
  });

  it.each([2, 3, 6, 10])('deveTerminarComVencedorUmaPartidaDe%iBots', (jogadores) => {
    const partida = novaPartida(jogadores, jogadores * 13, {
      quantidadeBaralhos: 2,
      vidasIniciais: 5,
      incluirOitoNoveDez: true,
      mortosVeemCartas: false,
      prazoDaVezSegundos: 30,
    });
    for (let passos = 0; passos < 100_000 && partida.faseAtual !== 'encerrada'; passos++) {
      avancar(partida);
    }
    const visao = partida.visaoPara(null);
    expect(visao.fase).toBe('encerrada');
    expect(visao.vencedores.length).toBeGreaterThanOrEqual(1);
    expect(visao.idDaVez).toBeNull();
  });
});

describe('Partida — mão, saídas e entradas', () => {
  it('deveEntregarAMaoOrdenadaDaMaisForteParaAMaisFraca', () => {
    const partida = novaPartida(3, 11);
    jogarAteFimDaRodada(partida);
    partida.iniciarProximaRodada();

    const visao = partida.visaoPara('j0');
    const valores = valoresEmJogo(false);
    const forca = (c: Carta) => forcaDaCarta(c, visao.manilha as Valor, valores);
    const mao = visao.minhaMao as Carta[];
    expect(mao.length).toBe(2);
    for (let i = 1; i < mao.length; i++) {
      expect(forca(mao[i - 1] as Carta)).toBeGreaterThanOrEqual(forca(mao[i] as Carta));
    }
  });

  it('deveSortearOsLugaresACadaPartida', () => {
    const ordens = new Set(
      [1, 2, 3, 4, 5].map((semente) =>
        novaPartida(4, semente)
          .visaoPara(null)
          .jogadores.map((j) => j.id)
          .join(','),
      ),
    );
    expect(ordens.size).toBeGreaterThan(1);
  });

  it('deveMarcarQuemAbreARodadaAEsquerdaDoPe', () => {
    const partida = novaPartida(4, 5);
    const visao = partida.visaoPara(null);
    const indiceDoPe = visao.jogadores.findIndex((j) => j.id === visao.idDoPe);
    expect(visao.idDoPrimeiro).toBe(visao.jogadores[(indiceDoPe + 1) % 4]?.id);
    expect(visao.idDaVez).toBe(visao.idDoPrimeiro);
  });

  it('deveDeixarQuemSaiJogarAteOFimDaRodadaEEntaoEliminarOuRemover', () => {
    const partida = novaPartida(4, 9);
    partida.agendarSaida('j1', 'eliminar');
    partida.agendarSaida('j2', 'remover');
    expect(partida.saiAoFimDaRodada('j1')).toBe(true);
    expect(partida.estaJogando('j1')).toBe(false);

    jogarAteFimDaRodada(partida);
    const fim = partida.visaoPara(null);
    expect(fim.jogadores.find((j) => j.id === 'j1')?.eliminado).toBe(true);
    expect(fim.resultadoRodada?.some((r) => r.jogadorId === 'j2')).toBe(true);

    partida.iniciarProximaRodada();
    const seguinte = partida.visaoPara(null);
    expect(seguinte.jogadores.map((j) => j.id).sort()).toEqual(['j0', 'j1', 'j3']);
    expect(seguinte.cartasPorJogador).toBe(2);
  });

  it('deveLembrarQuemDeixaAMesaMesmoDepoisDeOAssentoSumir', () => {
    const partida = novaPartida(4, 9);
    partida.agendarSaida('j1', 'eliminar');
    partida.agendarSaida('j2', 'remover');
    expect(partida.deixaAMesa('j1')).toBe(false);
    expect(partida.deixaAMesa('j2')).toBe(true);

    jogarAteFimDaRodada(partida);
    partida.iniciarProximaRodada();
    expect(partida.participa('j2')).toBe(false);
    expect(partida.deixaAMesa('j2')).toBe(true);
    expect(partida.deixaAMesa('j1')).toBe(false);
  });

  it('deveEncerrarQuandoAsSaidasDeixamUmUnicoJogador', () => {
    const partida = novaPartida(2, 4);
    partida.agendarSaida('j1', 'remover');
    jogarAteFimDaRodada(partida);
    const visao = partida.visaoPara(null);
    expect(visao.fase).toBe('encerrada');
    expect(visao.vencedores).toEqual(['j0']);
  });

  it('deveSentarQuemEntraNaProximaRodadaComAMaiorVida', () => {
    const partida = novaPartida(3, 21);
    partida.adicionarJogador('novo');
    expect(partida.aguardandoEntrada('novo')).toBe(true);
    expect(partida.participa('novo')).toBe(false);

    jogarAteFimDaRodada(partida);
    const maiorVida = Math.max(
      ...partida
        .visaoPara(null)
        .jogadores.filter((j) => !j.eliminado)
        .map((j) => j.vidas),
    );
    partida.iniciarProximaRodada();
    const visao = partida.visaoPara('novo');
    expect(visao.jogadores.find((j) => j.id === 'novo')?.vidas).toBe(maiorVida);
    expect(visao.minhaMao).toHaveLength(visao.cartasPorJogador);
  });

  it('deveCancelarAEntradaDeQuemDesisteAntesDeSentar', () => {
    const partida = novaPartida(2, 8);
    partida.adicionarJogador('novo');
    partida.agendarSaida('novo', 'remover');
    jogarAteFimDaRodada(partida);
    if (partida.faseAtual === 'fim_de_rodada') partida.iniciarProximaRodada();
    expect(partida.participa('novo')).toBe(false);
  });
});

describe('Partida — rodada cega', () => {
  it('deveRevelarTodasAsCartasEResolverAVazaAssimQueOsPalpitesTerminam', () => {
    const partida = novaPartida(3, 17);
    expect(partida.visaoPara('j0').minhaMao.every(ehCartaOculta)).toBe(true);

    palpitarTodos(partida);
    const visao = partida.visaoPara('j0');
    expect(visao.fase).toBe('fim_de_rodada');
    expect(visao.ultimaVaza?.jogadas).toHaveLength(3);
    expect(visao.jogadores.every((j) => j.cartasNaMao === 0)).toBe(true);
    expect(visao.resultadoRodada).toHaveLength(3);
  });
});
