import type { ConfiguracaoPartida } from '@fodinha/shared';
import { describe, expect, it } from 'vitest';
import type { Partida, VisaoDaPartida } from '../../src/domain/partida';
import { avancarPartida, criarPartida, geradorComSemente, jogarRodadaAteOFim } from '../apoio';

const DOIS_BARALHOS: ConfiguracaoPartida = {
  quantidadeBaralhos: 2,
  vidasIniciais: 5,
  incluirOitoNoveDez: true,
};

/** Evita o estreitamento de tipo do TS: a fase muda por efeito colateral das chamadas. */
const encerrou = (partida: Partida): boolean => partida.faseAtual === 'encerrada';

const quantidadesDeVazas = (visao: VisaoDaPartida) =>
  new Map(visao.jogadores.map((j) => [j.id, j.vazasGanhas.length]));

describe('Partida — vazasGanhas (montinhos)', () => {
  it('deveGuardarUmMontinhoComACartaVencedoraEAQuantidadeDeCartasDeCadaVazaFechada', () => {
    let vencidas = 0;
    let anuladas = 0;

    for (let semente = 1; semente <= 40; semente++) {
      const partida = criarPartida(2 + (semente % 5), semente, DOIS_BARALHOS);
      for (let rodada = 0; rodada < 6 && partida.faseAtual !== 'encerrada'; rodada++) {
        while (partida.faseAtual === 'palpites' || partida.faseAtual === 'jogando') {
          const antes = partida.visaoPara(null);
          avancarPartida(partida);
          const depois = partida.visaoPara(null);

          for (const jogador of depois.jogadores) {
            expect(jogador.vazasFeitas).toBe(jogador.vazasGanhas.length);
          }
          if (depois.ultimaVaza === antes.ultimaVaza) continue;

          const vaza = depois.ultimaVaza;
          expect(vaza).not.toBeNull();
          const contagemAntes = quantidadesDeVazas(antes);
          const contagemDepois = quantidadesDeVazas(depois);

          if (vaza?.vencedorId == null) {
            anuladas += 1;
            expect(contagemDepois).toEqual(contagemAntes);
            // Vaza toda anulada vira um montinho sem dono, com a carta mais forte por cima.
            expect(depois.vazasEmpatadas).toHaveLength(antes.vazasEmpatadas.length + 1);
            expect(depois.vazasEmpatadas.at(-1)).toEqual({
              cartaDoTopo: vaza?.jogadas[0]?.carta,
              quantidadeDeCartas: vaza?.jogadas.length,
            });
            continue;
          }
          expect(depois.vazasEmpatadas).toEqual(antes.vazasEmpatadas);
          vencidas += 1;
          for (const [id, quantidade] of contagemAntes) {
            expect(contagemDepois.get(id)).toBe(quantidade + (id === vaza.vencedorId ? 1 : 0));
          }
          const montinho = depois.jogadores
            .find((j) => j.id === vaza.vencedorId)
            ?.vazasGanhas.at(-1);
          const jogadaVencedora = vaza.jogadas.find((j) => j.jogadorId === vaza.vencedorId);
          expect(montinho).toEqual({
            cartaVencedora: jogadaVencedora?.carta,
            quantidadeDeCartas: vaza.jogadas.length,
          });
        }
        if (partida.faseAtual !== 'fim_de_rodada') break;
        partida.iniciarProximaRodada();
        if (encerrou(partida)) break;
        // Os montinhos são da rodada: zeram na distribuição seguinte.
        expect(partida.visaoPara(null).jogadores.every((j) => j.vazasGanhas.length === 0)).toBe(
          true,
        );
        expect(partida.visaoPara(null).vazasEmpatadas).toEqual([]);
      }
    }
    expect(vencidas).toBeGreaterThan(0);
    expect(anuladas).toBeGreaterThan(0);
  });

  it('deveContarNoMontinhoApenasAsCartasDosQueAindaEstaoVivos', () => {
    const partida = criarPartida(3, 17);
    partida.agendarSaida('j2', 'eliminar');
    jogarRodadaAteOFim(partida);
    partida.iniciarProximaRodada();
    jogarRodadaAteOFim(partida);

    const visao = partida.visaoPara(null);
    const montinhos = visao.jogadores.flatMap((j) => j.vazasGanhas);
    expect(montinhos.every((m) => m.quantidadeDeCartas <= 2)).toBe(true);
    expect(visao.jogadores.every((j) => j.vazasFeitas === j.vazasGanhas.length)).toBe(true);
  });
});

describe('Partida — saídas simultâneas', () => {
  it('deveEscolherOVencedorEntreTodosQuandoTodosOsQueRestamSaemNaMesmaViradaDeRodada', () => {
    const partida = criarPartida(3, 6);
    partida.agendarSaida('j0', 'remover');
    partida.agendarSaida('j1', 'eliminar');
    partida.agendarSaida('j2', 'remover');
    jogarRodadaAteOFim(partida);

    const visao = partida.visaoPara(null);
    expect(visao.fase).toBe('encerrada');
    expect(visao.vencedores.length).toBeGreaterThanOrEqual(1);
    const maisVidas = Math.max(...visao.jogadores.map((j) => j.vidas));
    expect(
      visao.vencedores.every((id) => visao.jogadores.find((j) => j.id === id)?.vidas === maisVidas),
    ).toBe(true);
  });

  it('deveDarAVitoriaAQuemFicouQuandoOsDemaisSaem', () => {
    const partida = criarPartida(3, 6);
    partida.agendarSaida('j1', 'remover');
    partida.agendarSaida('j2', 'eliminar');
    jogarRodadaAteOFim(partida);

    expect(partida.visaoPara(null).fase).toBe('encerrada');
    expect(partida.visaoPara(null).vencedores).toEqual(['j0']);
  });

  it('deveContinuarQuandoUmSobraEHaEntranteEsperando', () => {
    const partida = criarPartida(2, 8);
    partida.adicionarJogador('novo');
    partida.agendarSaida('j1', 'remover');
    jogarRodadaAteOFim(partida);

    expect(partida.faseAtual).toBe('fim_de_rodada');
    partida.iniciarProximaRodada();
    expect(partida.visaoPara(null).jogadores.map((j) => j.id)).toEqual(['j0', 'novo']);
  });
});

/** Compara o que a previsão promete com o que `iniciarProximaRodada` de fato faz. */
function conferirPrevisao(partida: Partida): void {
  const previsao = partida.previsaoDaProximaRodada();
  partida.iniciarProximaRodada();
  const real = partida.visaoPara(null);

  if (previsao === null) {
    expect(real.fase).toBe('encerrada');
    return;
  }
  expect(real.fase).toBe('palpites');
  expect(real.cartasPorJogador).toBe(previsao.cartasPorJogador);
  expect(real.idDoPrimeiro).toBe(previsao.idDoPrimeiro);
}

describe('Partida — previsaoDaProximaRodada', () => {
  it('deveSerNulaForaDoIntervaloEntreRodadas', () => {
    const partida = criarPartida(3, 4);
    expect(partida.previsaoDaProximaRodada()).toBeNull();
    // A rodada 1 é cega e se resolve sozinha ao fim dos palpites: a fase de jogadas é da rodada 2.
    jogarRodadaAteOFim(partida);
    partida.iniciarProximaRodada();
    while (partida.faseAtual === 'palpites') avancarPartida(partida);
    expect(partida.faseAtual).toBe('jogando');
    expect(partida.previsaoDaProximaRodada()).toBeNull();

    const dupla = criarPartida(2, 4);
    dupla.agendarSaida('j1', 'remover');
    jogarRodadaAteOFim(dupla);
    expect(dupla.faseAtual).toBe('encerrada');
    expect(dupla.previsaoDaProximaRodada()).toBeNull();
  });

  it('deveBaterComARodadaSeguinteAoLongoDeUmaPartidaInteira', () => {
    for (const jogadores of [2, 3, 5, 10]) {
      const partida = criarPartida(jogadores, jogadores * 11, DOIS_BARALHOS);
      for (let passos = 0; passos < 5_000 && partida.faseAtual !== 'encerrada'; passos++) {
        if (partida.faseAtual === 'fim_de_rodada') conferirPrevisao(partida);
        else avancarPartida(partida);
      }
      expect(partida.faseAtual).toBe('encerrada');
    }
  });

  it('deveConsiderarASaidaDoPeAtual', () => {
    for (const modo of ['remover', 'eliminar'] as const) {
      const partida = criarPartida(5, 12);
      partida.agendarSaida(partida.visaoPara(null).idDoPe as string, modo);
      jogarRodadaAteOFim(partida);
      expect(partida.faseAtual).toBe('fim_de_rodada');
      conferirPrevisao(partida);
    }
  });

  it('deveConsiderarOEntranteQueSentaNoFimDaMesa', () => {
    const partida = criarPartida(3, 21);
    partida.adicionarJogador('novo');
    jogarRodadaAteOFim(partida);

    const previsao = partida.previsaoDaProximaRodada();
    expect(previsao).not.toBeNull();
    conferirPrevisao(partida);
    expect(partida.visaoPara('novo').jogadores.some((j) => j.id === 'novo')).toBe(true);
  });

  it('deveSerNulaQuandoOUnicoEntranteDesisteEPartidaEncerraNaViradaSeguinte', () => {
    const partida = criarPartida(2, 8);
    partida.adicionarJogador('novo');
    partida.agendarSaida('j1', 'remover');
    jogarRodadaAteOFim(partida);
    expect(partida.faseAtual).toBe('fim_de_rodada');

    partida.agendarSaida('novo', 'remover');
    expect(partida.previsaoDaProximaRodada()).toBeNull();
    partida.iniciarProximaRodada();
    expect(partida.visaoPara(null).vencedores).toEqual(['j0']);
  });

  it('deveBaterEmCenariosComSaidasEEntradasSorteadas', () => {
    for (let semente = 1; semente <= 60; semente++) {
      const sorteio = geradorComSemente(semente * 101);
      const partida = criarPartida(2 + Math.floor(sorteio() * 6), semente, DOIS_BARALHOS);
      let entrantes = 0;

      const talvezMudarAMesa = (chance: number) => {
        if (partida.faseAtual === 'encerrada') return;
        if (sorteio() < chance) {
          const candidatos = partida
            .visaoPara(null)
            .jogadores.filter((j) => !j.eliminado && !j.saiAoFimDaRodada);
          const alvo = candidatos[Math.floor(sorteio() * candidatos.length)];
          if (alvo) partida.agendarSaida(alvo.id, sorteio() < 0.5 ? 'remover' : 'eliminar');
        }
        if (!encerrou(partida) && sorteio() < chance) {
          partida.adicionarJogador(`novo${entrantes++}`);
        }
      };

      for (let rodada = 0; rodada < 30 && partida.faseAtual !== 'encerrada'; rodada++) {
        talvezMudarAMesa(0.4);
        jogarRodadaAteOFim(partida);
        talvezMudarAMesa(0.3);
        if (partida.faseAtual !== 'fim_de_rodada') break;
        conferirPrevisao(partida);
      }
    }
  });
});
