import { describe, expect, it } from 'vitest';
import type { JogadaNaMesa, VazaResolvida } from '@fodinha/shared';
import { detectarEventos } from '../../../src/features/som/eventos';
import { EU, jogador, partida } from '../../apoio/partida';

function jogada(jogadorId: string, id: string): JogadaNaMesa {
  return { jogadorId, carta: { id, valor: '4', naipe: 'paus' }, anulada: false };
}

function vaza(vencedorId: string | null, ids: readonly string[] = ['c1', 'c2']): VazaResolvida {
  return { vencedorId, jogadas: ids.map((id, indice) => jogada(`j${indice}`, id)) };
}

const JOGANDO = partida({ fase: 'jogando', idDaVez: 'a' });

describe('detectarEventos', () => {
  it('naoDeveSoarNadaSemMudanca', () => {
    expect(detectarEventos(JOGANDO, JOGANDO, EU)).toEqual([]);
  });

  it('deveAnunciarARodadaNova', () => {
    const nova = partida({ numeroRodada: 3, idDaVez: 'a' });
    expect(detectarEventos(partida(), nova, EU)).toEqual(['novaRodada']);
  });

  it('deveSoarACartaJogada', () => {
    const depois = partida({ ...JOGANDO, mesa: [jogada('a', 'c1')], idDaVez: 'b' });
    expect(detectarEventos(JOGANDO, depois, EU)).toEqual(['cartaJogada']);
  });

  it('deveSoarAUltimaCartaEOVencedorQuandoAVazaFecha', () => {
    const antes = partida({ ...JOGANDO, mesa: [jogada('a', 'c1')] });
    const minha = partida({ ...JOGANDO, ultimaVaza: vaza(EU) });
    expect(detectarEventos(antes, minha, EU)).toEqual(['cartaJogada', 'vazaMinha']);
    const deOutro = partida({ ...JOGANDO, ultimaVaza: vaza('a') });
    expect(detectarEventos(antes, deOutro, EU)).toEqual(['cartaJogada', 'vazaDeOutro']);
  });

  it('deveSoarAVazaAnuladaQuandoTodasSeAnulam', () => {
    const anulada = partida({ ...JOGANDO, ultimaVaza: vaza(null) });
    expect(detectarEventos(JOGANDO, anulada, EU)).toEqual(['cartaJogada', 'vazaAnulada']);
  });

  it('naoDeveRepetirAMesmaVazaFechada', () => {
    const fechada = partida({ ...JOGANDO, ultimaVaza: vaza('a') });
    const outroEstado = partida({ ...fechada, idDaVez: 'b' });
    expect(detectarEventos(fechada, outroEstado, EU)).toEqual([]);
  });

  it('deveRevelarARodadaCegaComoUmaVazaFechada', () => {
    // Na rodada cega as cartas vão juntas à mesa e a vaza fecha no mesmo estado.
    const antes = partida({ rodadaCega: true, cartasPorJogador: 1 });
    const revelada = partida({
      ...antes,
      fase: 'fim_de_rodada',
      ultimaVaza: vaza(EU, ['c1', 'c2', 'c3', 'c4']),
    });
    expect(detectarEventos(antes, revelada, EU)).toEqual(['cartaJogada', 'vazaMinha']);
  });

  it('deveAvisarQuandoVireiAVez', () => {
    const minhaVez = partida({ ...JOGANDO, idDaVez: EU });
    expect(detectarEventos(JOGANDO, minhaVez, EU)).toEqual(['minhaVez']);
    expect(detectarEventos(minhaVez, minhaVez, EU)).toEqual([]);
  });

  it('deveAvisarDeNovoQuandoAFaseMudaNaMinhaVez', () => {
    // Palpitei por último e abro a primeira vaza: é minha vez de novo, agora para jogar.
    const palpitando = partida({ idDaVez: EU });
    const jogando = partida({ ...palpitando, fase: 'jogando' });
    expect(detectarEventos(palpitando, jogando, EU)).toEqual(['minhaVez']);
  });

  it('naoDeveAvisarAVezComAMesaPausada', () => {
    const pausada = partida({
      ...JOGANDO,
      idDaVez: EU,
      pausa: { votacoes: [], pausadaPeloDono: true, lendoRegras: null },
    });
    expect(detectarEventos(JOGANDO, pausada, EU)).toEqual([]);
  });

  it('deveSoarOPalpiteConfirmadoEAVidaPerdida', () => {
    const comPalpite = partida({ jogadores: [jogador('a'), jogador(EU, { palpite: 1 })] });
    expect(
      detectarEventos(partida({ jogadores: [jogador('a'), jogador(EU)] }), comPalpite, EU),
    ).toEqual(['palpiteConfirmado']);
    const antes = partida({ jogadores: [jogador(EU, { vidas: 5 })] });
    const depois = partida({ jogadores: [jogador(EU, { vidas: 3 })] });
    expect(detectarEventos(antes, depois, EU)).toEqual(['perdiVida']);
  });

  it('deveFecharAPartidaComVitoriaOuDerrotaSemOutrosAvisos', () => {
    const antes = partida({ ...JOGANDO, jogadores: [jogador(EU, { vidas: 1 }), jogador('a')] });
    const fim = { fase: 'encerrada', idDaVez: null } as const;
    const venci = partida({ ...antes, ...fim, vencedores: [EU] });
    expect(detectarEventos(antes, venci, EU)).toEqual(['vitoria']);
    const perdi = partida({
      ...antes,
      ...fim,
      vencedores: ['a'],
      jogadores: [jogador(EU, { vidas: 0, eliminado: true }), jogador('a')],
    });
    // A vida perdida não soa junto: o lamento da derrota já diz tudo.
    expect(detectarEventos(antes, perdi, EU)).toEqual(['derrota']);
  });

  it('deixaOEspectadorSemFanfarraNoFim', () => {
    const antes = partida({ ...JOGANDO, jogadores: [jogador('a'), jogador('b')] });
    const fim = partida({ ...antes, fase: 'encerrada', idDaVez: null, vencedores: ['a'] });
    expect(detectarEventos(antes, fim, EU)).toEqual([]);
  });

  it('naoDeveSoarFimDePartidaDuasVezes', () => {
    const fim = partida({ fase: 'encerrada', idDaVez: null, vencedores: [EU] });
    expect(detectarEventos(fim, fim, EU)).toEqual([]);
  });

  it('deveListarNaOrdemEmQueDeveSoar', () => {
    const antes = partida({
      ...JOGANDO,
      mesa: [jogada('a', 'c1')],
      jogadores: [jogador('a'), jogador(EU, { palpite: 1 })],
    });
    const depois = partida({
      ...antes,
      fase: 'palpites',
      numeroRodada: 3,
      mesa: [],
      ultimaVaza: vaza('a'),
      idDaVez: EU,
      jogadores: [jogador('a'), jogador(EU, { vidas: 4 })],
    });
    expect(detectarEventos(antes, depois, EU)).toEqual([
      'novaRodada',
      'cartaJogada',
      'vazaDeOutro',
      'perdiVida',
      'minhaVez',
    ]);
  });
});
