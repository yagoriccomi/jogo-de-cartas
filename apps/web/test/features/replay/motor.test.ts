import type { EstadoPartidaVisivel, RodadaDoReplay } from '@fodinha/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jogarCarta, palpitar, sairDaSala } from '../../../src/estado/acoes';
import { atualizar, obterEstado } from '../../../src/estado/armazem';
import {
  alternarPlay,
  encerrarReplay,
  iniciarReplay,
  lanceAnterior,
  proximoLance,
  pularParaProximaRodada,
} from '../../../src/features/replay/motor';
import { EU, partida } from '../../apoio/partida';

const { pedidas, emitidos } = vi.hoisted(() => ({
  pedidas: [] as number[],
  emitidos: [] as string[],
}));

const TOTAL = 3;
const LANCES_POR_RODADA = 3;

function lances(rodada: number): EstadoPartidaVisivel[] {
  return Array.from({ length: LANCES_POR_RODADA }, (_, indice) =>
    partida({
      numeroRodada: rodada,
      fase: indice === LANCES_POR_RODADA - 1 ? 'fim_de_rodada' : 'jogando',
      idDaVez: EU,
    }),
  );
}

// O servidor de mentira devolve 3 rodadas de 3 lances; a 99 não existe.
vi.mock('../../../src/features/replay/historico', () => ({
  buscarRodadaDoReplay: (idPartida: string, numero: number) => {
    pedidas.push(numero);
    if (idPartida === 'sumiu') {
      return Promise.resolve({
        ok: false,
        motivo: 'nao_encontrada',
        mensagem: 'Partida não encontrada.',
      });
    }
    const dados: RodadaDoReplay = {
      idPartida,
      numeroRodada: numero,
      totalDeRodadas: TOTAL,
      jogadorId: EU,
      lances: lances(numero),
    };
    return Promise.resolve({ ok: true, dados });
  },
}));

vi.mock('../../../src/lib/socket', () => ({
  socket: { emit: (evento: string) => emitidos.push(evento) },
  requisitar: () => Promise.resolve(null),
  ErroDeRequisicao: class extends Error {},
}));

function posicao() {
  const { fonte } = obterEstado();
  if (fonte.origem !== 'replay') throw new Error('replay desligado');
  return { rodada: fonte.rodada, lance: fonte.lance, tocando: fonte.tocando };
}

beforeEach(() => {
  vi.useFakeTimers();
  pedidas.length = 0;
  emitidos.length = 0;
});

afterEach(() => {
  encerrarReplay();
  atualizar({ avisos: [] });
  vi.useRealTimers();
});

describe('motor do replay', () => {
  it('deveAbrirNaPrimeiraRodadaParadoComASessaoDoAssentoDaConta', async () => {
    expect(await iniciarReplay('p1')).toBe(true);
    expect(posicao()).toEqual({ rodada: 1, lance: 0, tocando: false });
    expect(obterEstado().sessao?.jogadorId).toBe(EU);
    expect(obterEstado().jogo?.numeroRodada).toBe(1);
    expect(obterEstado().sala?.participantes.some((p) => p.ehAnfitriao)).toBe(false);
  });

  it('deveAvisarENaoAbrirQuandoOServidorRecusa', async () => {
    expect(await iniciarReplay('sumiu')).toBe(false);
    expect(obterEstado().fonte.origem).toBe('servidor');
    expect(obterEstado().avisos.map((a) => a.mensagem)).toContain('Partida não encontrada.');
  });

  it('deveNavegarLanceARodadaEVoltarAoFimDaAnterior', async () => {
    await iniciarReplay('p1');
    await proximoLance();
    await proximoLance();
    await proximoLance();
    expect(posicao()).toMatchObject({ rodada: 2, lance: 0 });
    await lanceAnterior();
    expect(posicao()).toMatchObject({ rodada: 1, lance: LANCES_POR_RODADA - 1 });
    await pularParaProximaRodada();
    await pularParaProximaRodada();
    expect(posicao()).toMatchObject({ rodada: 3, lance: 0 });
    // Cada rodada é pedida uma vez só: as seguintes vêm do cache (e a próxima, adiantada).
    expect(new Set(pedidas).size).toBe(pedidas.length);
  });

  it('deveTocarSozinhoAteOFimEPararNoUltimoLance', async () => {
    await iniciarReplay('p1');
    alternarPlay();
    expect(posicao().tocando).toBe(true);
    await vi.runAllTimersAsync();
    expect(posicao()).toEqual({ rodada: TOTAL, lance: LANCES_POR_RODADA - 1, tocando: false });
  });

  it('deveRecusarAsAcoesDeJogoSemFalarComOServidorESairPeloMesmoCaminho', async () => {
    await iniciarReplay('p1');
    expect(await palpitar(1)).toBe(false);
    expect(await jogarCarta('qualquer')).toBe(false);
    expect(emitidos).toEqual([]);
    await sairDaSala();
    expect(obterEstado().fonte.origem).toBe('servidor');
    expect(obterEstado().sessao).toBeNull();
    expect(obterEstado().jogo).toBeNull();
  });
});
