import {
  CONFIGURACAO_PADRAO,
  type Carta,
  type ConfiguracaoPartida,
  type EstadoPartidaVisivel,
  type EstadoSala,
  type ReacaoNaMesa,
  type Naipe,
  type SessaoJogador,
  type Valor,
} from '@fodinha/shared';
import { CondutorDePartidas, type TemposDoCondutor } from '../src/application/condutor-de-partidas';
import type { Notificador, Relogio } from '../src/application/portas';
import { ServicoDeSalas } from '../src/application/servico-de-salas';
import type { GeradorAleatorio } from '../src/domain/aleatoriedade';
import {
  EstrategiaDoBot,
  criarEstrategiasDosPerfis,
  type EstrategiasDosPerfis,
} from '../src/domain/estrategia-bot';
import { Partida } from '../src/domain/partida';
import { RepositorioDeSalasEmMemoria } from '../src/infrastructure/adaptadores';

/** Gerador determinístico (mulberry32) para partidas reproduzíveis nos testes. */
export function geradorComSemente(semente: number): GeradorAleatorio {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sorteio que nunca cai na margem de erro do bot: os testes veem sempre a melhor jogada dele. */
export const BOT_SEM_ERRO = (): number => 0.99;

let sequencial = 0;
export function carta(valor: Valor, naipe: Naipe): Carta {
  sequencial += 1;
  return { id: `t${sequencial}`, valor, naipe };
}

// ---------------------------------------------------------------------------------------------
// Partida (domínio)
// ---------------------------------------------------------------------------------------------

const estrategia = new EstrategiaDoBot(BOT_SEM_ERRO);

export function criarPartida(
  jogadores = 4,
  semente = 42,
  configuracao: ConfiguracaoPartida = CONFIGURACAO_PADRAO,
): Partida {
  const jogadorIds = Array.from({ length: jogadores }, (_, i) => `j${i}`);
  return Partida.iniciar({ configuracao, jogadorIds, gerarAleatorio: geradorComSemente(semente) });
}

/** Executa uma ação (palpite, carta ou próxima rodada) pelo jogador da vez, com a estratégia do bot. */
export function avancarPartida(partida: Partida): void {
  if (partida.faseAtual === 'fim_de_rodada') {
    partida.iniciarProximaRodada();
    return;
  }
  const id = partida.idDaVez as string;
  const visao = partida.visaoPara(id);
  if (partida.faseAtual === 'palpites') {
    partida.palpitar(id, estrategia.escolherPalpite(visao, partida.palpitesPermitidos(id)));
    return;
  }
  partida.jogarCarta(id, estrategia.escolherCarta(visao, id));
}

export function jogarRodadaAteOFim(partida: Partida): void {
  while (partida.faseAtual === 'palpites' || partida.faseAtual === 'jogando') {
    avancarPartida(partida);
  }
}

// ---------------------------------------------------------------------------------------------
// Aplicação (serviço + condutor com relógio falso)
// ---------------------------------------------------------------------------------------------

/** Relógio controlado manualmente: `avancar` dispara os agendamentos vencidos, em ordem. */
export class RelogioFalso implements Relogio {
  private instante = 0;
  private sequencia = 0;
  private agendados: { quando: number; ordem: number; acao: () => void }[] = [];

  agora(): number {
    return this.instante;
  }

  agendar(atrasoMs: number, acao: () => void): () => void {
    const item = { quando: this.instante + atrasoMs, ordem: this.sequencia++, acao };
    this.agendados.push(item);
    return () => {
      this.agendados = this.agendados.filter((a) => a !== item);
    };
  }

  avancar(ms: number): void {
    const alvo = this.instante + ms;
    for (;;) {
      const proximo = [...this.agendados]
        .filter((a) => a.quando <= alvo)
        .sort((a, b) => a.quando - b.quando || a.ordem - b.ordem)[0];
      if (!proximo) break;
      this.agendados = this.agendados.filter((a) => a !== proximo);
      this.instante = proximo.quando;
      proximo.acao();
    }
    this.instante = alvo;
  }
}

export class NotificadorFalso implements Notificador {
  readonly salas = new Map<string, EstadoSala>();
  readonly partidas = new Map<string, EstadoPartidaVisivel>();
  readonly reacoes: { destinatarios: readonly string[]; reacao: ReacaoNaMesa }[] = [];

  enviarEstadoSala(ids: readonly string[], estado: EstadoSala): void {
    for (const id of ids) this.salas.set(id, estado);
  }

  enviarEstadoPartida(id: string, estado: EstadoPartidaVisivel): void {
    this.partidas.set(id, estado);
  }

  enviarReacao(destinatarios: readonly string[], reacao: ReacaoNaMesa): void {
    this.reacoes.push({ destinatarios, reacao });
  }
}

export const PRAZO_MS = 30_000;
export const CARENCIA_MS = 10_000;
export const ATRASO_BOT_MS = 900;
export const PAUSA_FIM_RODADA_MS = 4_000;
export const ABANDONO_MS = 600_000;

const silencioso = { info: () => {}, warn: () => {}, error: () => {} };

/** Sorteio que nunca cai na chance de reação: deixa os bots calados nos testes que não tratam disso. */
export const BOTS_CALADOS = (): number => 1;

export interface Ator {
  readonly codigoSala: string;
  readonly jogadorId: string;
}

export const ator = (sessao: Ator): Ator => ({
  codigoSala: sessao.codigoSala,
  jogadorId: sessao.jogadorId,
});

/** Monta serviço + condutor + relógio falso, com identificadores e sorteio determinísticos. */
export function montarCenario(
  temposExtras: Partial<TemposDoCondutor> = {},
  sorteioDosBots: () => number = BOTS_CALADOS,
  estrategias: EstrategiasDosPerfis = criarEstrategiasDosPerfis(BOT_SEM_ERRO),
) {
  const relogio = new RelogioFalso();
  const notificador = new NotificadorFalso();
  const repositorio = new RepositorioDeSalasEmMemoria();
  let contador = 0;
  const condutor = new CondutorDePartidas({
    notificador,
    relogio,
    estrategias,
    registrador: silencioso,
    gerarAleatorio: sorteioDosBots,
    tempos: {
      atrasoDoBotMs: ATRASO_BOT_MS,
      pausaFimDeRodadaMs: PAUSA_FIM_RODADA_MS,
      // Zero por padrão: os testes contam a pausa sem saber se a rodada era cega.
      pausaExtraRodadaCegaMs: 0,
      carenciaDeDesconexaoMs: CARENCIA_MS,
      ...temposExtras,
    },
  });
  const servico = new ServicoDeSalas({
    repositorio,
    condutor,
    identificadores: {
      novoId: () => `id${++contador}`,
      novoToken: () => `token${++contador}`,
      novoCodigoSala: () => `SALA${++contador}`,
    },
    relogio,
    gerarAleatorio: geradorComSemente(3),
    registrador: silencioso,
    tempoDeAbandonoMs: ABANDONO_MS,
  });

  const partidaDe = (sessao: Ator) => notificador.partidas.get(sessao.jogadorId);
  const salaDe = (sessao: Ator) => notificador.salas.get(sessao.jogadorId);

  /** Cria a sala; o dispositivo padrão do criador é `disp-ana`. */
  function criarSala(apelido = 'Ana', dispositivoId = `disp-${apelido.toLowerCase()}`) {
    return servico.criarSala({ apelido, configuracao: CONFIGURACAO_PADRAO, dispositivoId });
  }

  function entrar(sala: Ator, apelido: string, dispositivoId = `disp-${apelido.toLowerCase()}`) {
    return servico.entrarSala({ codigoSala: sala.codigoSala, apelido, dispositivoId });
  }

  function reconectar(sessao: SessaoJogador, dispositivoId: string) {
    return servico.reconectar({
      codigoSala: sessao.codigoSala,
      tokenSessao: sessao.tokenSessao,
      dispositivoId,
    });
  }

  function desconectar(sessao: Ator): void {
    servico.desconectar(ator(sessao));
  }

  /** Faz cada humano da lista agir (palpite ou carta) enquanto for a vez de algum deles. */
  function humanosJogam(humanos: readonly SessaoJogador[]): void {
    for (let passo = 0; passo < 200; passo++) {
      const humano = humanos.find((h) => partidaDe(h)?.idDaVez === h.jogadorId);
      if (!humano) return;
      const estado = partidaDe(humano) as EstadoPartidaVisivel;
      if (estado.fase === 'palpites') {
        servico.palpitar(ator(humano), estado.palpiteProibido === 0 ? 1 : 0);
      } else {
        servico.jogarCarta(ator(humano), (estado.minhaMao[0] as { id: string }).id);
      }
    }
  }

  /** Joga a rodada em curso (humanos agem, bots e pausas correm pelo relógio) até começar outra. */
  function jogarAteNovaRodada(humanos: readonly SessaoJogador[], observador: SessaoJogador): void {
    const rodada = partidaDe(observador)?.numeroRodada;
    for (let i = 0; i < 40; i++) {
      const estado = partidaDe(observador);
      if (!estado || estado.numeroRodada !== rodada || estado.fase === 'encerrada') return;
      humanosJogam(humanos);
      relogio.avancar(ATRASO_BOT_MS + PAUSA_FIM_RODADA_MS);
    }
  }

  return {
    relogio,
    notificador,
    repositorio,
    servico,
    partidaDe,
    salaDe,
    criarSala,
    entrar,
    reconectar,
    desconectar,
    humanosJogam,
    jogarAteNovaRodada,
  };
}

export type Cenario = ReturnType<typeof montarCenario>;
