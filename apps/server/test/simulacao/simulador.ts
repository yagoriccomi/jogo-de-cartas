import { CONFIGURACAO_PADRAO } from '@fodinha/shared';
import type { EstrategiaDeJogo } from '../../src/domain/estrategia-bot';
import { Partida } from '../../src/domain/partida';
import { geradorComSemente } from '../apoio';

/** Dois bots disputando a mesma mesa, cada um com metade dos lugares. */
export interface Competidores {
  readonly novo: (semente: number) => EstrategiaDeJogo;
  readonly antigo: (semente: number) => EstrategiaDeJogo;
}

export interface Placar {
  readonly rodadasJogadas: number;
  readonly vidasPerdidas: number;
  /** Vitórias divididas: empate entre dois vencedores vale meia para cada. */
  readonly vitorias: number;
}

export interface ResultadoDaSimulacao {
  readonly partidas: number;
  readonly novo: Placar;
  readonly antigo: Placar;
}

type Lado = 'novo' | 'antigo';

export interface OpcoesDaSimulacao {
  readonly pares: number;
  readonly jogadores: number;
  /** Permite repartir as sementes entre vários processos (`simular-em-paralelo.ts`). */
  readonly primeiraSemente?: number;
}

// Partida que não acaba nesse número de ações indica laço no motor: melhor falhar do que travar.
const MAXIMO_DE_ACOES_POR_PARTIDA = 20_000;

function ladoDe(jogadorId: string): Lado {
  return jogadorId.startsWith('novo') ? 'novo' : 'antigo';
}

/**
 * Cada semente roda duas vezes com os lados trocados: as mesmas cartas e os mesmos lugares caem
 * ora com um bot, ora com o outro, e a sorte do baralho se cancela na comparação.
 */
export function simular(
  { pares, jogadores, primeiraSemente = 1 }: OpcoesDaSimulacao,
  competidores: Competidores,
): ResultadoDaSimulacao {
  const placar = {
    novo: { rodadasJogadas: 0, vidasPerdidas: 0, vitorias: 0 },
    antigo: { rodadasJogadas: 0, vidasPerdidas: 0, vitorias: 0 },
  };
  for (let semente = primeiraSemente; semente < primeiraSemente + pares; semente++) {
    for (const espelhada of [false, true]) {
      const ids = Array.from({ length: jogadores }, (_, i) => {
        const novo = (i % 2 === 0) !== espelhada;
        return `${novo ? 'novo' : 'antigo'}-${i}`;
      });
      jogarPartida(ids, semente, competidores, placar);
    }
  }
  return { partidas: pares * 2, ...placar };
}

function jogarPartida(
  ids: readonly string[],
  semente: number,
  competidores: Competidores,
  placar: Record<Lado, { rodadasJogadas: number; vidasPerdidas: number; vitorias: number }>,
): void {
  const partida = Partida.iniciar({
    configuracao: CONFIGURACAO_PADRAO,
    jogadorIds: [...ids],
    gerarAleatorio: geradorComSemente(semente),
  });
  const estrategias = { novo: competidores.novo(semente), antigo: competidores.antigo(semente) };

  for (let acao = 0; acao < MAXIMO_DE_ACOES_POR_PARTIDA; acao++) {
    if (partida.faseAtual === 'encerrada') {
      const { vencedores } = partida.visaoPara(null);
      for (const id of vencedores) placar[ladoDe(id)].vitorias += 1 / vencedores.length;
      return;
    }
    if (partida.faseAtual === 'fim_de_rodada') {
      for (const resultado of partida.visaoPara(null).resultadoRodada ?? []) {
        placar[ladoDe(resultado.jogadorId)].rodadasJogadas += 1;
        placar[ladoDe(resultado.jogadorId)].vidasPerdidas += resultado.vidasPerdidas;
      }
      partida.iniciarProximaRodada();
      continue;
    }
    const id = partida.idDaVez as string;
    const estrategia = estrategias[ladoDe(id)];
    const visao = partida.visaoPara(id);
    if (partida.faseAtual === 'palpites') {
      partida.palpitar(id, estrategia.escolherPalpite(visao, partida.palpitesPermitidos(id)));
    } else {
      partida.jogarCarta(id, estrategia.escolherCarta(visao, id));
    }
  }
  throw new Error(`Partida da semente ${semente} não terminou.`);
}

export function vidasPorRodada(placar: Placar): number {
  return placar.vidasPerdidas / Math.max(1, placar.rodadasJogadas);
}
