import type { EstadoPartidaVisivel } from '@fodinha/shared';
import type { EstrategiaDeJogo } from '../domain/estrategia-bot';
import type { Partida } from '../domain/partida';
import type { Sala } from '../domain/sala';
import type { Cancelamento, Notificador, Registrador, Relogio } from './portas';

export interface TemposDoCondutor {
  /** Quanto o humano tem para agir antes de o servidor jogar por ele. */
  readonly prazoDaVezMs: number;
  /** Atraso artificial do bot, para que os humanos acompanhem as jogadas. */
  readonly atrasoDoBotMs: number;
  /** Tempo de exibição do resultado da rodada antes da próxima distribuição. */
  readonly pausaFimDeRodadaMs: number;
}

export interface DependenciasDoCondutor {
  readonly notificador: Notificador;
  readonly relogio: Relogio;
  readonly estrategia: EstrategiaDeJogo;
  readonly registrador: Registrador;
  readonly tempos: TemposDoCondutor;
}

/**
 * Faz a partida andar sozinha quando ninguém age: joga pelos bots, joga por quem estourou o prazo
 * e distribui a próxima rodada após a pausa. Também publica o estado visível a cada mudança.
 */
export class CondutorDePartidas {
  private readonly acoesAgendadas = new Map<string, Cancelamento>();
  private readonly prazos = new Map<string, number>();

  constructor(private readonly deps: DependenciasDoCondutor) {}

  /** Deve ser chamado após QUALQUER mudança na sala: reagenda o próximo passo e notifica todos. */
  aposMudanca(sala: Sala): void {
    this.agendarProximoPasso(sala);
    this.publicar(sala);
  }

  encerrar(codigoSala: string): void {
    this.acoesAgendadas.get(codigoSala)?.();
    this.acoesAgendadas.delete(codigoSala);
    this.prazos.delete(codigoSala);
  }

  publicar(sala: Sala): void {
    const humanos = sala.todos.filter((p) => !p.ehBot).map((p) => p.id);
    this.deps.notificador.enviarEstadoSala(humanos, sala.estado());

    const partida = sala.partida;
    if (!partida) return;
    for (const id of humanos) {
      this.deps.notificador.enviarEstadoPartida(id, this.estadoVisivel(sala, partida, id));
    }
  }

  private estadoVisivel(sala: Sala, partida: Partida, jogadorId: string): EstadoPartidaVisivel {
    const visao = partida.visaoPara(partida.participa(jogadorId) ? jogadorId : null);
    return {
      ...visao,
      prazoDaVezEm: this.prazos.get(sala.codigo) ?? null,
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

  private agendarProximoPasso(sala: Sala): void {
    this.encerrar(sala.codigo);
    const partida = sala.partida;
    if (!partida || partida.faseAtual === 'encerrada') return;

    const { tempos, relogio } = this.deps;
    if (partida.faseAtual === 'fim_de_rodada') {
      this.agendar(sala, tempos.pausaFimDeRodadaMs, () => partida.iniciarProximaRodada());
      return;
    }

    const idDaVez = partida.idDaVez as string;
    if (sala.participante(idDaVez)?.ehBot) {
      this.agendar(sala, tempos.atrasoDoBotMs, () => this.jogarPor(partida, idDaVez));
      return;
    }
    this.prazos.set(sala.codigo, relogio.agora() + tempos.prazoDaVezMs);
    this.agendar(sala, tempos.prazoDaVezMs, () => this.jogarPor(partida, idDaVez));
  }

  private agendar(sala: Sala, atrasoMs: number, passo: () => void): void {
    const cancelar = this.deps.relogio.agendar(atrasoMs, () => {
      this.acoesAgendadas.delete(sala.codigo);
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
    this.acoesAgendadas.set(sala.codigo, cancelar);
  }

  private jogarPor(partida: Partida, jogadorId: string): void {
    const visao = partida.visaoPara(jogadorId);
    const { estrategia } = this.deps;
    if (partida.faseAtual === 'palpites') {
      partida.palpitar(
        jogadorId,
        estrategia.escolherPalpite(visao, partida.palpitesPermitidos(jogadorId)),
      );
      return;
    }
    partida.jogarCarta(jogadorId, estrategia.escolherCarta(visao, jogadorId));
  }
}
