import type { DesfechoDoDiario, DiarioDaPartida, MotivoDoFim } from '../domain/diario';
import type { Sala } from '../domain/sala';
import type { GeradorDeIdentificadores, RegistroDePartidas, Registrador, Relogio } from './portas';

export interface DependenciasDoHistorico {
  readonly registro: RegistroDePartidas;
  readonly identificadores: Pick<GeradorDeIdentificadores, 'novoId'>;
  readonly relogio: Pick<Relogio, 'agora'>;
  readonly registrador: Registrador;
}

interface PartidaAcompanhada {
  readonly idPartida: string;
  readonly diario: DiarioDaPartida;
  encerrada: boolean;
}

/**
 * Leva o diário de cada sala real ao registro: abre a partida, grava cada rodada que termina e
 * encerra no fim (ou quando a partida é reiniciada ou a sala some). A gravação é assíncrona e fica
 * fora do caminho da jogada: um banco lento ou fora do ar só deixa um erro no log, a mesa segue.
 */
export class HistoricoDePartidas {
  /** Por código de sala: uma sala tem no máximo uma partida corrente. */
  private readonly acompanhadas = new Map<string, PartidaAcompanhada>();
  /** Uma fila só: as gravações de uma partida chegam ao banco na ordem em que aconteceram. */
  private fila: Promise<void> = Promise.resolve();

  constructor(private readonly deps: DependenciasDoHistorico) {}

  /** Chamado depois de qualquer mudança na sala; sem novidade no diário, não grava nada. */
  acompanhar(sala: Sala): void {
    if (sala.cenarioDeTeste) return;
    const diario = sala.diario;
    const atual = this.acompanhadas.get(sala.codigo);
    // Diário novo na mesma sala: o dono reiniciou, e a partida anterior não termina mais.
    if (atual && atual.diario !== diario) this.fechar(sala.codigo, atual, 'interrompida');
    if (!diario) return;

    const acompanhada =
      atual && atual.diario === diario ? atual : this.comecar(sala.codigo, diario);
    this.gravarConcluidas(acompanhada);
    const desfecho = diario.desfecho;
    if (desfecho && !acompanhada.encerrada) this.encerrar(acompanhada, desfecho);
  }

  /** A sala deixou de existir: a partida em andamento fica registrada como abandonada. */
  esquecer(codigoSala: string): void {
    const atual = this.acompanhadas.get(codigoSala);
    if (atual) this.fechar(codigoSala, atual, 'abandonada');
  }

  /** Resolve quando tudo o que foi pedido até agora terminou (gravado ou com o erro no log). */
  aguardarGravacoes(): Promise<void> {
    return this.fila;
  }

  private comecar(codigoSala: string, diario: DiarioDaPartida): PartidaAcompanhada {
    const acompanhada = { idPartida: this.deps.identificadores.novoId(), diario, encerrada: false };
    this.acompanhadas.set(codigoSala, acompanhada);
    const inicio = {
      idPartida: acompanhada.idPartida,
      em: this.deps.relogio.agora(),
      configuracao: diario.configuracao,
      participantes: diario.participantesIniciais,
    };
    this.enfileirar(acompanhada.idPartida, 'início da partida', () =>
      this.deps.registro.iniciarPartida(inicio),
    );
    return acompanhada;
  }

  private gravarConcluidas(acompanhada: PartidaAcompanhada): void {
    for (const { rodada, participantesNovos } of acompanhada.diario.retirarRodadasConcluidas()) {
      const gravacao = {
        idPartida: acompanhada.idPartida,
        em: this.deps.relogio.agora(),
        rodada,
        participantesNovos,
      };
      this.enfileirar(acompanhada.idPartida, 'rodada', () =>
        this.deps.registro.gravarRodada(gravacao),
      );
    }
  }

  private encerrar(acompanhada: PartidaAcompanhada, desfecho: DesfechoDoDiario): void {
    acompanhada.encerrada = true;
    const fim = { idPartida: acompanhada.idPartida, em: this.deps.relogio.agora(), desfecho };
    this.enfileirar(acompanhada.idPartida, 'fim da partida', () =>
      this.deps.registro.encerrarPartida(fim),
    );
  }

  private fechar(
    codigoSala: string,
    acompanhada: PartidaAcompanhada,
    motivo: Exclude<MotivoDoFim, 'fim'>,
  ): void {
    this.gravarConcluidas(acompanhada);
    if (!acompanhada.encerrada)
      this.encerrar(acompanhada, acompanhada.diario.desfechoSemFim(motivo));
    this.acompanhadas.delete(codigoSala);
  }

  /** Erro do banco (até o lançado na hora) vira log: nunca sobe para quem está jogando. */
  private enfileirar(idPartida: string, oQue: string, gravar: () => Promise<void>): void {
    this.fila = this.fila.then(gravar).catch((erro: unknown) => {
      this.deps.registrador.error(
        { erro, partida: idPartida },
        `Falha ao gravar ${oQue} no histórico`,
      );
    });
  }
}
