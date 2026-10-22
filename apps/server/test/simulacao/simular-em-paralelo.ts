/**
 * Simulação acelerada para ajustar os bots: só números, sem servidor, sem tela e sem atrasos,
 * com as mesas repartidas entre os núcleos do processador.
 *
 *   npm run simular -w apps/server -- --pares 2000 --mesas 3,10 --contra anterior
 *
 * Cada perfil joga contra o adversário escolhido (`anterior` = o bot de antes dos perfis, ou
 * qualquer perfil) em partidas espelhadas; a tabela mostra vidas perdidas por rodada e vitórias.
 */
import { availableParallelism } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { NOMES_DOS_PERFIS, PERFIS_DE_BOT, type PerfilDeBot } from '../../src/domain/bot/perfis';
import { EstrategiaDoBot, type EstrategiaDeJogo } from '../../src/domain/estrategia-bot';
import { geradorComSemente } from '../apoio';
import { EstrategiaAnterior } from './estrategia-anterior';
import { simular, vidasPorRodada, type Placar, type ResultadoDaSimulacao } from './simulador';

type Adversario = PerfilDeBot | 'anterior';

interface Tarefa {
  readonly perfil: PerfilDeBot;
  readonly contra: Adversario;
  readonly jogadores: number;
  readonly primeiraSemente: number;
  readonly pares: number;
}

// Igual à simulação dos testes: a margem de erro joga junto, com sorteio separado das cartas.
const DESLOCAMENTO_DA_SEMENTE_DO_ERRO = 10_000;
// Pedaços pequenos o bastante para todos os núcleos terminarem quase juntos.
const PARES_POR_TAREFA = 50;

function estrategia(quem: Adversario, semente: number): EstrategiaDeJogo {
  if (quem === 'anterior') return new EstrategiaAnterior();
  return new EstrategiaDoBot(geradorComSemente(semente + DESLOCAMENTO_DA_SEMENTE_DO_ERRO), quem);
}

function executar(tarefa: Tarefa): ResultadoDaSimulacao {
  return simular(tarefa, {
    novo: (semente) => estrategia(tarefa.perfil, semente),
    antigo: (semente) => estrategia(tarefa.contra, semente),
  });
}

// ---------------------------------------------------------------------------------------------
// Processo de trabalho: recebe tarefas, devolve placares
// ---------------------------------------------------------------------------------------------

if (!isMainThread) {
  const tarefas = workerData as Tarefa[];
  parentPort?.postMessage(tarefas.map((tarefa) => ({ tarefa, resultado: executar(tarefa) })));
} else {
  await principal();
}

// ---------------------------------------------------------------------------------------------
// Processo principal: reparte, junta e imprime
// ---------------------------------------------------------------------------------------------

function argumento(nome: string, padrao: string): string {
  const posicao = process.argv.indexOf(`--${nome}`);
  return posicao >= 0 ? (process.argv[posicao + 1] ?? padrao) : padrao;
}

function somar(a: Placar, b: Placar): Placar {
  return {
    rodadasJogadas: a.rodadasJogadas + b.rodadasJogadas,
    vidasPerdidas: a.vidasPerdidas + b.vidasPerdidas,
    vitorias: a.vitorias + b.vitorias,
  };
}

async function principal(): Promise<void> {
  const pares = Number(argumento('pares', '1000'));
  const mesas = argumento('mesas', '3,10').split(',').map(Number);
  const contra = argumento('contra', 'anterior') as Adversario;
  const perfis = argumento('perfis', PERFIS_DE_BOT.join(',')).split(',') as PerfilDeBot[];

  const tarefas: Tarefa[] = [];
  for (const jogadores of mesas) {
    for (const perfil of perfis) {
      for (let inicio = 1; inicio <= pares; inicio += PARES_POR_TAREFA) {
        const tamanho = Math.min(PARES_POR_TAREFA, pares - inicio + 1);
        tarefas.push({ perfil, contra, jogadores, primeiraSemente: inicio, pares: tamanho });
      }
    }
  }

  const nucleos = Math.max(1, Math.min(availableParallelism() - 1, tarefas.length));
  const lotes = Array.from({ length: nucleos }, (_, i) =>
    tarefas.filter((_, indice) => indice % nucleos === i),
  );
  const inicio = performance.now();
  const respostas = await Promise.all(
    lotes.map(
      (lote) =>
        new Promise<{ tarefa: Tarefa; resultado: ResultadoDaSimulacao }[]>((resolver, rejeitar) => {
          // O script roda empacotado (`npm run simular`): cada worker abre o mesmo arquivo.
          const worker = new Worker(new URL(import.meta.url), { workerData: lote });
          worker.once('message', resolver);
          worker.once('error', rejeitar);
        }),
    ),
  );

  const totais = new Map<string, ResultadoDaSimulacao>();
  for (const { tarefa, resultado } of respostas.flat()) {
    const chave = `${tarefa.jogadores}|${tarefa.perfil}`;
    const anterior = totais.get(chave);
    totais.set(
      chave,
      anterior
        ? {
            partidas: anterior.partidas + resultado.partidas,
            novo: somar(anterior.novo, resultado.novo),
            antigo: somar(anterior.antigo, resultado.antigo),
          }
        : resultado,
    );
  }

  const nomeDoAdversario = contra === 'anterior' ? 'bot anterior' : NOMES_DOS_PERFIS[contra];
  console.info(
    `\n${pares} pares por perfil e mesa contra o ${nomeDoAdversario} · ${nucleos} núcleos · ` +
      `${((performance.now() - inicio) / 1000).toFixed(1)} s\n`,
  );
  const linhas = [...totais].map(([chave, resultado]) => {
    const [jogadores, perfil] = chave.split('|') as [string, PerfilDeBot];
    return {
      mesa: Number(jogadores),
      perfil: NOMES_DOS_PERFIS[perfil],
      partidas: resultado.partidas,
      'vidas/rodada': Number(vidasPorRodada(resultado.novo).toFixed(3)),
      'vidas/rodada adv.': Number(vidasPorRodada(resultado.antigo).toFixed(3)),
      'vitórias %': Number(((100 * resultado.novo.vitorias) / resultado.partidas).toFixed(1)),
    };
  });
  console.table(linhas.sort((a, b) => a.mesa - b.mesa));
}
