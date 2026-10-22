import { LIMITES, REACOES, type EstadoPartidaVisivel, type ReacaoNaMesa } from '@fodinha/shared';
import type { GeradorAleatorio } from '../domain/aleatoriedade';
import { PERFIL_DA_JOGADA_AUTOMATICA } from '../domain/bot/perfis';
import type { EstrategiasDosPerfis } from '../domain/estrategia-bot';
import type { Partida } from '../domain/partida';
import type { Sala } from '../domain/sala';
import type { Cancelamento, Notificador, Registrador, Relogio } from './portas';

/** Chance de o bot mandar uma reação a cada carta que joga: dá vida à mesa sem virar spam. */
export const CHANCE_DE_REACAO_DO_BOT = 0.1;
const MS_POR_SEGUNDO = 1000;
const LIMITE_DA_LEITURA_DAS_REGRAS_MS = LIMITES.maxLeituraDasRegrasSegundos * MS_POR_SEGUNDO;

export interface TemposDoCondutor {
  /** Atraso artificial do bot, para que os humanos acompanhem as jogadas. */
  readonly atrasoDoBotMs: number;
  /** Tempo de exibição do resultado da rodada antes da próxima distribuição. */
  readonly pausaFimDeRodadaMs: number;
  /**
   * Acréscimo à pausa quando a rodada que acabou era cega: as cartas vão sozinhas à mesa de uma
   * vez e o jogador precisa de mais tempo para descobrir a própria carta e entender o resultado.
   */
  readonly pausaExtraRodadaCegaMs: number;
  /** Tolerância a quedas curtas (recarregar a página) antes de pausar a partida (premissa P1). */
  readonly carenciaDeDesconexaoMs: number;
}

export interface DependenciasDoCondutor {
  readonly notificador: Notificador;
  readonly relogio: Relogio;
  /** Bot joga com o próprio perfil; quem estourou o prazo ou está saindo, com o neutro. */
  readonly estrategias: EstrategiasDosPerfis;
  readonly registrador: Registrador;
  readonly tempos: TemposDoCondutor;
  /** Sorteia as reações dos bots; injetado para os testes serem determinísticos. */
  readonly gerarAleatorio: GeradorAleatorio;
}

type Momento = {
  readonly tipo: 'vez' | 'proximaRodada' | 'leituraDasRegras';
  readonly em: number;
};

/**
 * Faz a partida andar sozinha quando ninguém age: joga pelos bots, joga por quem estourou o prazo,
 * distribui a próxima rodada após a pausa e abre a votação de espera de quem caiu.
 * Todo agendamento é reconciliado com o estado da sala a cada mudança, então nenhuma combinação
 * (início, reinício, entrada no meio, queda no lobby) deixa um ausente sem carência.
 */
export class CondutorDePartidas {
  private readonly passos = new Map<string, Cancelamento>();
  private readonly momentos = new Map<string, Momento>();
  /** Carências por sala → jogador. */
  private readonly carencias = new Map<string, Map<string, Cancelamento>>();

  constructor(private readonly deps: DependenciasDoCondutor) {}

  /** Deve ser chamado após QUALQUER mudança na sala: reagenda o próximo passo e notifica todos. */
  aposMudanca(sala: Sala): void {
    sala.descartarQuemSaiu();
    this.reconciliarCarencias(sala);
    this.agendarProximoPasso(sala);
    this.publicar(sala);
  }

  /** A sala deixou de existir: cancela tudo o que estava agendado para ela. */
  encerrar(codigoSala: string): void {
    this.cancelarPasso(codigoSala);
    for (const cancelar of this.carencias.get(codigoSala)?.values() ?? []) cancelar();
    this.carencias.delete(codigoSala);
  }

  publicar(sala: Sala): void {
    // Quem saiu não recebe mais nada, mesmo enquanto um bot termina a rodada por ele.
    const humanos = sala.todos.filter((p) => !p.ehBot && !p.saindo).map((p) => p.id);
    this.deps.notificador.enviarEstadoSala(humanos, sala.estado());

    const partida = sala.partida;
    if (!partida) return;
    for (const id of humanos) {
      this.deps.notificador.enviarEstadoPartida(id, this.estadoVisivel(sala, partida, id));
    }
  }

  /** Reação é efêmera: vai a quem está na sala agora e não altera nem agenda nada. */
  publicarReacao(sala: Sala, reacao: ReacaoNaMesa): void {
    const humanos = sala.todos.filter((p) => !p.ehBot && !p.saindo).map((p) => p.id);
    this.deps.notificador.enviarReacao(humanos, reacao);
  }

  private estadoVisivel(sala: Sala, partida: Partida, jogadorId: string): EstadoPartidaVisivel {
    const visao = partida.visaoPara(partida.participa(jogadorId) ? jogadorId : null);
    const momento = this.momentos.get(sala.codigo);
    const restante = (tipo: Momento['tipo']) =>
      momento?.tipo === tipo ? Math.max(0, momento.em - this.deps.relogio.agora()) : null;
    const previsao = partida.previsaoDaProximaRodada();
    const leitura = sala.leituraDasRegras;
    return {
      ...visao,
      prazoDaVezEm: momento?.tipo === 'vez' ? momento.em : null,
      prazoDaVezRestanteMs: restante('vez'),
      proximaRodada: previsao && { ...previsao, comecaEmMs: restante('proximaRodada') },
      pausa: sala.pausada
        ? {
            votacoes: sala.votacoesVisiveis(),
            pausadaPeloDono: sala.pausadaPeloDono,
            lendoRegras: leitura && {
              jogadorId: leitura.jogadorId,
              restanteMs: restante('leituraDasRegras') ?? 0,
            },
          }
        : null,
      jogadores: visao.jogadores.map((jogador) => {
        const participante = sala.participante(jogador.id);
        return {
          ...jogador,
          apelido: participante?.apelido ?? '—',
          ehBot: participante?.ehBot ?? false,
          conectado: participante?.conectado ?? false,
        };
      }),
    };
  }

  /** Arma a carência de quem precisa e desarma a de quem voltou, saiu ou já tem votação. */
  private reconciliarCarencias(sala: Sala): void {
    const daSala = this.carencias.get(sala.codigo) ?? new Map<string, Cancelamento>();
    this.carencias.set(sala.codigo, daSala);
    const precisam = new Set(sala.ausentesSemVotacao());

    for (const [jogadorId, cancelar] of daSala) {
      if (precisam.has(jogadorId)) continue;
      cancelar();
      daSala.delete(jogadorId);
    }
    for (const jogadorId of precisam) {
      if (daSala.has(jogadorId)) continue;
      const cancelar = this.deps.relogio.agendar(this.deps.tempos.carenciaDeDesconexaoMs, () => {
        daSala.delete(jogadorId);
        if (!sala.abrirVotacao(jogadorId, this.deps.relogio.agora())) return;
        this.deps.registrador.info({ sala: sala.codigo }, 'Partida pausada por desconexão');
        // O ausente deixou de ser eleitor: alguma votação aberta pode se resolver agora.
        this.registrarEliminados(sala, sala.resolverVotacoes());
        this.aposMudanca(sala);
      });
      daSala.set(jogadorId, cancelar);
    }
  }

  private registrarEliminados(sala: Sala, eliminados: readonly string[]): void {
    if (eliminados.length === 0) return;
    this.deps.registrador.info(
      { sala: sala.codigo, quantidade: eliminados.length },
      'Ausente eliminado por votação',
    );
  }

  private agendarProximoPasso(sala: Sala): void {
    this.cancelarPasso(sala.codigo);
    const partida = sala.partida;
    if (!partida || partida.faseAtual === 'encerrada') return;
    // A leitura das regras é a única pausa com fim marcado: o relógio dela anda mesmo pausado.
    const leitura = sala.leituraDasRegras;
    if (leitura) {
      const atrasoMs = Math.max(
        0,
        leitura.desde + LIMITE_DA_LEITURA_DAS_REGRAS_MS - this.deps.relogio.agora(),
      );
      this.agendar(sala, { tipo: 'leituraDasRegras', atrasoMs }, () =>
        sala.encerrarLeituraDasRegras(leitura.jogadorId),
      );
      return;
    }
    // Pausa congela a mesa inteira (premissa P4): nada é agendado até a votação se resolver.
    if (sala.pausada) return;

    const { tempos } = this.deps;
    if (partida.faseAtual === 'fim_de_rodada') {
      const atrasoMs =
        tempos.pausaFimDeRodadaMs + (partida.rodadaCega ? tempos.pausaExtraRodadaCegaMs : 0);
      this.agendar(sala, { tipo: 'proximaRodada', atrasoMs }, () => partida.iniciarProximaRodada());
      return;
    }

    const idDaVez = partida.idDaVez as string;
    const conduzidoPorBot =
      !!sala.participante(idDaVez)?.ehBot || partida.saiAoFimDaRodada(idDaVez);
    if (conduzidoPorBot) {
      this.agendar(sala, { atrasoMs: tempos.atrasoDoBotMs }, () =>
        this.jogarPor(sala, partida, idDaVez),
      );
      return;
    }
    const prazoMs = sala.prazoDaVezMs;
    if (prazoMs === null) return;
    this.agendar(sala, { tipo: 'vez', atrasoMs: prazoMs }, () => {
      this.jogarPor(sala, partida, idDaVez);
      this.botsZoamQuemPerdeuAVez(sala);
    });
  }

  /** `tipo` informado = o prazo é exibido aos jogadores (contagem regressiva). */
  private agendar(
    sala: Sala,
    quando: { readonly tipo?: Momento['tipo']; readonly atrasoMs: number },
    passo: () => void,
  ): void {
    const { relogio } = this.deps;
    if (quando.tipo) {
      this.momentos.set(sala.codigo, { tipo: quando.tipo, em: relogio.agora() + quando.atrasoMs });
    }
    const cancelar = relogio.agendar(quando.atrasoMs, () => {
      this.passos.delete(sala.codigo);
      try {
        passo();
      } catch (erro) {
        // Não deveria acontecer: a estratégia só escolhe jogadas válidas. Loga e segue com o estado atual.
        this.deps.registrador.error(
          { erro, sala: sala.codigo },
          'Falha ao executar passo automático',
        );
      }
      this.aposMudanca(sala);
    });
    this.passos.set(sala.codigo, cancelar);
  }

  private cancelarPasso(codigoSala: string): void {
    this.passos.get(codigoSala)?.();
    this.passos.delete(codigoSala);
    this.momentos.delete(codigoSala);
  }

  private jogarPor(sala: Sala, partida: Partida, jogadorId: string): void {
    const visao = partida.visaoPara(jogadorId);
    const perfil = sala.participante(jogadorId)?.perfilDoBot ?? PERFIL_DA_JOGADA_AUTOMATICA;
    const estrategia = this.deps.estrategias[perfil];
    if (partida.faseAtual === 'palpites') {
      partida.palpitar(
        jogadorId,
        estrategia.escolherPalpite(visao, partida.palpitesPermitidos(jogadorId)),
      );
      return;
    }
    partida.jogarCarta(jogadorId, estrategia.escolherCarta(visao, jogadorId));
    // Só bot de verdade: quem estourou o prazo ou está saindo é humano e fala por si.
    if (sala.participante(jogadorId)?.ehBot) this.talvezReagirComoBot(sala, jogadorId);
  }

  private talvezReagirComoBot(sala: Sala, jogadorId: string): void {
    if (this.deps.gerarAleatorio() >= CHANCE_DE_REACAO_DO_BOT) return;
    this.reagirComoBot(sala, jogadorId);
  }

  /** Humano estourou o prazo: a mesa inteira de bots reage, cada um com um emoji sorteado. */
  private botsZoamQuemPerdeuAVez(sala: Sala): void {
    for (const bot of sala.todos) {
      if (bot.ehBot && !bot.saindo) this.reagirComoBot(sala, bot.id);
    }
  }

  private reagirComoBot(sala: Sala, jogadorId: string): void {
    const { gerarAleatorio, relogio } = this.deps;
    const reacao = REACOES[Math.floor(gerarAleatorio() * REACOES.length)];
    if (!reacao) return;
    this.publicarReacao(sala, { jogadorId, reacao, em: relogio.agora() });
  }
}
