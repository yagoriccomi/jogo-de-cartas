import { REACOES, type EstadoPartidaVisivel, type EstadoSala } from '@fodinha/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as acoes from '../../src/estado/acoes';
import {
  atualizar,
  obterEstado,
  receberDoServidor,
  registrarReacao,
} from '../../src/estado/armazem';
import { SESSAO_DO_TUTORIAL } from '../../src/features/tutorial/mesaDoTutorial';
import {
  avancarTutorial,
  encerrarTutorial,
  iniciarTutorial,
  passoAtual,
} from '../../src/features/tutorial/motor';
import type { Espera } from '../../src/features/tutorial/roteiro';

const { emitidos } = vi.hoisted(() => ({ emitidos: [] as string[] }));

// O roteiro escolhe "toque"/"clique" pelo aparelho; no node não há `window`.
vi.mock('../../src/features/tutorial/ponteiro', () => ({
  usaToque: () => false,
  verboDeToque: () => 'Clique',
}));

// Socket de mentira: registra cada evento emitido e o servidor aceita tudo.
vi.mock('../../src/lib/socket', () => ({
  socket: {
    emit: (evento: string, ...argumentos: unknown[]) => {
      emitidos.push(evento);
      const responder = argumentos.at(-1) as (resposta: unknown) => void;
      responder({ ok: true, dados: null });
    },
  },
  requisitar: (enviar: (responder: (resposta: { dados: unknown }) => void) => void) =>
    new Promise((resolve) => enviar((resposta) => resolve(resposta.dados))),
  ErroDeRequisicao: class extends Error {},
}));

function origem(): string {
  return obterEstado().fonte.origem;
}

function indiceDoPasso(): number {
  const { fonte } = obterEstado();
  if (fonte.origem !== 'tutorial') throw new Error('tutorial desligado');
  return fonte.passo;
}

/** Anda pelo roteiro (botão e tempo dos bots) até o primeiro passo que espera a ação pedida. */
function avancarAte<T extends Espera['tipo']>(tipo: T): Extract<Espera, { tipo: T }> {
  for (let passos = 0; passos < 100; passos++) {
    const espera = passoAtual()?.espera;
    if (espera === undefined) break;
    if (espera.tipo === tipo) return espera as Extract<Espera, { tipo: T }>;
    if (espera.tipo === 'botao') avancarTutorial();
    else if (espera.tipo === 'tempo') vi.advanceTimersByTime(espera.ms);
    else throw new Error(`passo espera ${espera.tipo}, não ${tipo}`);
  }
  throw new Error(`o roteiro não chega a um passo de ${tipo}`);
}

const SALA_DO_SERVIDOR = { codigo: 'ABCD', configuracao: {} } as EstadoSala;
const JOGO_DO_SERVIDOR = { fase: 'jogando' } as EstadoPartidaVisivel;

beforeEach(() => {
  vi.useFakeTimers();
  emitidos.length = 0;
});

afterEach(() => {
  encerrarTutorial();
  atualizar({ avisos: [], reacoes: [] });
  vi.useRealTimers();
});

describe('fonte da partida', () => {
  it('deveComecarPeloServidor', () => {
    expect(origem()).toBe('servidor');
  });

  it('deveTrocarFonteESessaoJuntasAoIniciarOTutorial', () => {
    iniciarTutorial();

    expect(origem()).toBe('tutorial');
    expect(obterEstado().sessao).toBe(SESSAO_DO_TUTORIAL);
    expect(obterEstado().jogo).not.toBeNull();
    expect(indiceDoPasso()).toBe(0);
  });

  it('deveRecusarNoTutorialAsAcoesQueORoteiroNaoEnsinaSemTocarNoSocket', async () => {
    iniciarTutorial();
    const passo = indiceDoPasso();

    const respostas = await Promise.all([
      acoes.configurarSala(SALA_DO_SERVIDOR.configuracao),
      acoes.definirMortosVeemCartas(true),
      acoes.adicionarBot(),
      acoes.expulsarParticipante('alguem'),
      acoes.iniciarPartida(),
      acoes.reiniciarSala(),
      acoes.pausarPartida(),
      acoes.retomarPartida(),
      acoes.votarEspera('alguem', true),
      acoes.reagir(REACOES[0]),
      acoes.lerRegras(),
    ]);

    expect(respostas.every((aceitou) => !aceitou)).toBe(true);
    expect(await acoes.pararDeLerRegras()).toBe(true);
    expect(emitidos).toEqual([]);
    expect(indiceDoPasso()).toBe(passo);
  });

  it('deveAceitarSoOPalpiteQueOBalaoPede', async () => {
    iniciarTutorial();
    const espera = avancarAte('palpite');
    const passo = indiceDoPasso();

    expect(await acoes.palpitar(espera.valor + 1)).toBe(false);
    expect(indiceDoPasso()).toBe(passo);
    expect(obterEstado().avisos.map((aviso) => aviso.mensagem)).toContain(
      `No tutorial, escolha ${espera.valor}.`,
    );

    expect(await acoes.palpitar(espera.valor)).toBe(true);
    expect(indiceDoPasso()).toBe(passo + 1);
    expect(emitidos).toEqual([]);
  });

  it('deveAceitarSoACartaQueOBalaoAponta', async () => {
    iniciarTutorial();
    const palpite = avancarAte('palpite');
    await acoes.palpitar(palpite.valor);
    const espera = avancarAte('jogar');
    const passo = indiceDoPasso();

    expect(await acoes.jogarCarta('carta-que-nao-e-a-do-balao')).toBe(false);
    expect(indiceDoPasso()).toBe(passo);

    expect(await acoes.jogarCarta(espera.carta.id)).toBe(true);
    expect(indiceDoPasso()).toBe(passo + 1);
    expect(emitidos).toEqual([]);
  });

  it('deveDescartarOQueOServidorMandaDuranteOTutorial', async () => {
    iniciarTutorial();
    const { sala, jogo, sessao } = obterEstado();

    receberDoServidor({ sala: SALA_DO_SERVIDOR });
    receberDoServidor(() => ({ jogo: JOGO_DO_SERVIDOR }));
    registrarReacao({ jogadorId: 'alguem', reacao: REACOES[0], em: 0 });
    await acoes.retomarSessao();

    expect(obterEstado().sala).toBe(sala);
    expect(obterEstado().jogo).toBe(jogo);
    expect(obterEstado().sessao).toBe(sessao);
    expect(obterEstado().reacoes).toEqual([]);
    expect(emitidos).toEqual([]);
  });

  it('deveDevolverAFonteAoServidorAoSairDoTutorial', async () => {
    iniciarTutorial();

    await acoes.sairDaSala();

    expect(origem()).toBe('servidor');
    expect(obterEstado().sessao).toBeNull();
    expect(emitidos).toEqual([]);

    expect(await acoes.palpitar(2)).toBe(true);
    expect(emitidos).toEqual(['jogo:palpitar']);
    receberDoServidor({ sala: SALA_DO_SERVIDOR });
    expect(obterEstado().sala).toBe(SALA_DO_SERVIDOR);
  });
});
