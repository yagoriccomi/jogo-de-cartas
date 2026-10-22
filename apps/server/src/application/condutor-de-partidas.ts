import { REACOES, type EstadoPartidaVisivel, type ReacaoNaMesa } from '@fodinha/shared';
import { mesmoPasso, type ProximoPasso, type TemposDaMesa } from '../domain/agenda';
import type { GeradorAleatorio } from '../domain/aleatoriedade';
import { PERFIL_DA_JOGADA_AUTOMATICA } from '../domain/bot/perfis';
import type { EstrategiasDosPerfis } from '../domain/estrategia-bot';
import { jogarAVez } from '../domain/jogar-a-vez';
import type { Partida } from '../domain/partida';
import type { Desfecho, Sala } from '../domain/sala';
import type { Cancelamento, Notificador, Registrador, Relogio } from './portas';

/** Chance de o bot mandar uma reação a cada carta que joga: dá vida à mesa sem virar spam. */
export const CHANCE_DE_REACAO_DO_BOT = 0.1;

export interface TemposDoCondutor extends TemposDaMesa {
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

interface PassoArmado {
  readonly passo: ProximoPasso;
  readonly cancelar: Cancelamento;
}

/**
 * Faz a partida andar sozinha quando ninguém age: joga pelos bots, joga por quem estourou o prazo,
 * distribui a próxima rodada após a pausa e abre a votação de espera de quem caiu.
 * Todo agendamento é reconciliado com o estado da sala a cada mudança, então nenhuma combinação
 * (início, reinício, entrada no meio, queda no lobby) deixa um ausente sem carência.
 * O que fazer e quando é decisão da Sala (`reagendar`); aqui só se arma e desarma o timer.
 */
export class CondutorDePartidas {
  private readonly passos = new Map<string, PassoArmado>();
  /** Carências por sala → jogador. */
  private readonly carencias = new Map<string, Map<string, Cancelamento>>();

  constructor(private readonly deps: DependenciasDoCondutor) {}

  /**
   * Deve ser chamado após QUALQUER mudança na sala: registra o desfecho dela, reagenda o próximo
   * passo e notifica todos.
   */
  aposMudanca(sala: Sala, desfecho?: Desfecho): void {
    if (desfecho) this.registrarEliminados(sala, desfecho.eliminados);
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
    const humanos = sala
      .ativos()
      .filter((p) => !p.ehBot)
      .map((p) => p.id);
    this.deps.notificador.enviarEstadoSala(humanos, sala.estado());

    const partida = sala.partida;
    if (!partida) return;
    for (const id of humanos) {
      this.deps.notificador.enviarEstadoPartida(id, this.estadoVisivel(sala, partida, id));
    }
  }

  /** Reação é efêmera: vai a quem está na sala agora e não altera nem agenda nada. */
  publicarReacao(sala: Sala, reacao: ReacaoNaMesa): void {
    const humanos = sala
      .ativos()
      .filter((p) => !p.ehBot)
      .map((p) => p.id);
    this.deps.notificador.enviarReacao(humanos, reacao);
  }

  private estadoVisivel(sala: Sala, partida: Partida, jogadorId: string): EstadoPartidaVisivel {
    const visao = partida.visaoPara(partida.participa(jogadorId) ? jogadorId : null);
    const passo = this.passos.get(sala.codigo)?.passo;
    const restante = (tipo: ProximoPasso['tipo']) =>
      passo?.tipo === tipo ? Math.max(0, passo.em - this.deps.relogio.agora()) : null;
    const previsao = partida.previsaoDaProximaRodada();
    const leitura = sala.leituraDasRegras;
    return {
      ...visao,
      prazoDaVezEm: passo?.tipo === 'prazoDaVez' ? passo.em : null,
      prazoDaVezRestanteMs: restante('prazoDaVez'),
      proximaRodada: previsao && { ...previsao, comecaEmMs: restante('proximaRodada') },
      pausa: sala.pausada
        ? {
            votacoes: sala.votacoesVisiveis(),
            pausadaPeloDono: sala.pausadaPeloDono,
            lendoRegras: leitura && {
              jogadorId: leitura.jogadorId,
              restanteMs: restante('fimDaLeitura') ?? 0,
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
        const desfecho = sala.abrirVotacao(jogadorId, this.deps.relogio.agora());
        if (!desfecho) return;
        this.deps.registrador.info({ sala: sala.codigo }, 'Partida pausada por desconexão');
        this.aposMudanca(sala, desfecho);
      });
      daSala.set(jogadorId, cancelar);
    }
  }

  /** Único registro das eliminações por votação, venham do serviço ou da carência vencida. */
  private registrarEliminados(sala: Sala, eliminados: readonly string[]): void {
    if (eliminados.length === 0) return;
    this.deps.registrador.info(
      { sala: sala.codigo, quantidade: eliminados.length },
      'Ausente eliminado por votação',
    );
  }

  /** Idempotente: sem mudança de etapa, o timer armado (e o prazo exibido) fica como estava. */
  private agendarProximoPasso(sala: Sala): void {
    const { relogio, tempos } = this.deps;
    const agora = relogio.agora();
    const passo = sala.reagendar(agora, tempos);
    if (mesmoPasso(this.passos.get(sala.codigo)?.passo ?? null, passo)) return;
    this.cancelarPasso(sala.codigo);
    if (!passo) return;
    const cancelar = relogio.agendar(Math.max(0, passo.em - agora), () => {
      this.passos.delete(sala.codigo);
      try {
        this.executar(sala, passo);
      } catch (erro) {
        // Não deveria acontecer: a estratégia só escolhe jogadas válidas. Loga e segue com o estado atual.
        this.deps.registrador.error(
          { erro, sala: sala.codigo },
          'Falha ao executar passo automático',
        );
      }
      this.aposMudanca(sala);
    });
    this.passos.set(sala.codigo, { passo, cancelar });
  }

  private executar(sala: Sala, passo: ProximoPasso): void {
    if (passo.tipo === 'fimDaLeitura') {
      sala.encerrarLeituraDasRegras(passo.jogadorId);
      return;
    }
    const partida = sala.partida;
    if (!partida) return;
    if (passo.tipo === 'proximaRodada') {
      partida.iniciarProximaRodada();
      return;
    }
    this.jogarPor(sala, partida, passo.jogadorId);
    if (passo.tipo === 'prazoDaVez') this.botsZoamQuemPerdeuAVez(sala);
  }

  private cancelarPasso(codigoSala: string): void {
    this.passos.get(codigoSala)?.cancelar();
    this.passos.delete(codigoSala);
  }

  private jogarPor(sala: Sala, partida: Partida, jogadorId: string): void {
    const perfil = sala.participante(jogadorId)?.perfilDoBot ?? PERFIL_DA_JOGADA_AUTOMATICA;
    const jogada = jogarAVez(partida, jogadorId, this.deps.estrategias[perfil]);
    // Só bot de verdade: quem estourou o prazo ou está saindo é humano e fala por si.
    if (jogada.tipo === 'carta' && sala.participante(jogadorId)?.ehBot) {
      this.talvezReagirComoBot(sala, jogadorId);
    }
  }

  private talvezReagirComoBot(sala: Sala, jogadorId: string): void {
    if (this.deps.gerarAleatorio() >= CHANCE_DE_REACAO_DO_BOT) return;
    this.reagirComoBot(sala, jogadorId);
  }

  /** Humano estourou o prazo: a mesa inteira de bots reage, cada um com um emoji sorteado. */
  private botsZoamQuemPerdeuAVez(sala: Sala): void {
    for (const bot of sala.ativos()) {
      if (bot.ehBot) this.reagirComoBot(sala, bot.id);
    }
  }

  private reagirComoBot(sala: Sala, jogadorId: string): void {
    const { gerarAleatorio, relogio } = this.deps;
    const reacao = REACOES[Math.floor(gerarAleatorio() * REACOES.length)];
    if (!reacao) return;
    this.publicarReacao(sala, { jogadorId, reacao, em: relogio.agora() });
  }
}
