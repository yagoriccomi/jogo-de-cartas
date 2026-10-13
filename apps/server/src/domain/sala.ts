import {
  LIMITES,
  type ConfiguracaoPartida,
  type EstadoSala,
  type ParticipanteSala,
} from '@fodinha/shared';
import type { GeradorAleatorio } from './aleatoriedade';
import { validarConfiguracao } from './configuracao';
import { ErroDeRegra } from './erros';
import { Partida } from './partida';

export interface Participante {
  readonly id: string;
  readonly apelido: string;
  ehBot: boolean;
  conectado: boolean;
  /** Humano que saiu no meio da partida: um bot joga por ele até o fim e o assento é liberado depois. */
  assumidoPorBot?: boolean;
  /** Só humanos têm token; é o que permite reassumir o assento após queda de conexão. */
  readonly tokenSessao: string | null;
}

/** Sala de espera + partida corrente. Concentra as regras de quem pode fazer o quê. */
export class Sala {
  private readonly participantes: Participante[] = [];
  private anfitriaoId: string;
  private configuracao: ConfiguracaoPartida;
  private partidaAtual: Partida | null = null;

  constructor(
    readonly codigo: string,
    anfitriao: Participante,
    configuracao: unknown,
  ) {
    this.configuracao = validarConfiguracao(configuracao);
    this.participantes.push(anfitriao);
    this.anfitriaoId = anfitriao.id;
  }

  get partida(): Partida | null {
    return this.partidaAtual;
  }

  get emPartida(): boolean {
    return this.partidaAtual !== null && this.partidaAtual.faseAtual !== 'encerrada';
  }

  get todos(): readonly Participante[] {
    return this.participantes;
  }

  get humanosConectados(): number {
    return this.participantes.filter((p) => !p.ehBot && p.conectado).length;
  }

  /** Humanos que ainda pertencem à sala (conectados ou com queda temporária). */
  get humanosPresentes(): number {
    return this.participantes.filter((p) => !p.ehBot).length;
  }

  participante(id: string): Participante | undefined {
    return this.participantes.find((p) => p.id === id);
  }

  participantePorToken(token: string): Participante | undefined {
    return this.participantes.find((p) => p.tokenSessao === token);
  }

  adicionarHumano(participante: Participante): void {
    this.exigirLobby();
    this.exigirVaga();
    this.participantes.push(participante);
  }

  adicionarBot(solicitanteId: string, bot: Participante): void {
    this.exigirAnfitriao(solicitanteId);
    this.exigirLobby();
    this.exigirVaga();
    if (this.participantes.filter((p) => p.ehBot && !p.assumidoPorBot).length >= LIMITES.maxBots) {
      throw new ErroDeRegra('SALA_CHEIA', `A sala já tem o máximo de ${LIMITES.maxBots} bots.`);
    }
    this.participantes.push(bot);
  }

  removerParticipante(solicitanteId: string, alvoId: string): void {
    this.exigirAnfitriao(solicitanteId);
    this.exigirLobby();
    if (alvoId === solicitanteId) {
      throw new ErroDeRegra('ENTRADA_INVALIDA', 'Para sair da sala, use a opção de sair.');
    }
    this.retirar(alvoId);
  }

  configurar(solicitanteId: string, configuracao: unknown): void {
    this.exigirAnfitriao(solicitanteId);
    this.exigirLobby();
    this.configuracao = validarConfiguracao(configuracao);
  }

  iniciarPartida(solicitanteId: string, gerarAleatorio: GeradorAleatorio): Partida {
    this.exigirAnfitriao(solicitanteId);
    this.exigirLobby();
    // Quem saiu durante a partida anterior e foi assumido por bot não ocupa vaga na próxima.
    const permanecem = this.participantes.filter((p) => !p.assumidoPorBot);
    this.participantes.splice(0, this.participantes.length, ...permanecem);
    if (this.participantes.length < LIMITES.minJogadores) {
      throw new ErroDeRegra(
        'ENTRADA_INVALIDA',
        `São necessários pelo menos ${LIMITES.minJogadores} participantes para começar.`,
      );
    }
    this.partidaAtual = Partida.iniciar({
      configuracao: this.configuracao,
      jogadorIds: this.participantes.map((p) => p.id),
      gerarAleatorio,
    });
    return this.partidaAtual;
  }

  /**
   * No lobby, quem sai libera o assento. Durante a partida o assento não pode sumir
   * (quebraria a ordem da mesa), então um bot assume o lugar até o fim.
   */
  sair(participanteId: string): void {
    const participante = this.exigirParticipante(participanteId);
    if (this.emPartida) {
      participante.ehBot = true;
      participante.assumidoPorBot = true;
      participante.conectado = false;
    } else {
      this.retirar(participanteId);
    }
    if (participanteId === this.anfitriaoId) this.promoverNovoAnfitriao();
  }

  marcarConexao(participanteId: string, conectado: boolean): void {
    this.exigirParticipante(participanteId).conectado = conectado;
  }

  estado(): EstadoSala {
    return {
      codigo: this.codigo,
      configuracao: this.configuracao,
      emPartida: this.emPartida,
      participantes: this.participantes.map((p): ParticipanteSala => ({
        id: p.id,
        apelido: p.apelido,
        ehBot: p.ehBot,
        conectado: p.conectado,
        ehAnfitriao: p.id === this.anfitriaoId,
      })),
    };
  }

  private promoverNovoAnfitriao(): void {
    const proximo = this.participantes.find((p) => !p.ehBot);
    if (proximo) this.anfitriaoId = proximo.id;
  }

  private retirar(participanteId: string): void {
    const indice = this.participantes.findIndex((p) => p.id === participanteId);
    if (indice === -1) throw new ErroDeRegra('ENTRADA_INVALIDA', 'Participante não encontrado.');
    this.participantes.splice(indice, 1);
  }

  private exigirParticipante(participanteId: string): Participante {
    const participante = this.participante(participanteId);
    if (!participante) throw new ErroDeRegra('SEM_PERMISSAO', 'Você não está nesta sala.');
    return participante;
  }

  private exigirAnfitriao(solicitanteId: string): void {
    if (solicitanteId !== this.anfitriaoId) {
      throw new ErroDeRegra('SEM_PERMISSAO', 'Só o anfitrião da sala pode fazer isso.');
    }
  }

  private exigirLobby(): void {
    if (this.emPartida) {
      throw new ErroDeRegra('PARTIDA_EM_ANDAMENTO', 'Há uma partida em andamento nesta sala.');
    }
  }

  private exigirVaga(): void {
    if (this.participantes.length >= LIMITES.maxJogadores) {
      throw new ErroDeRegra('SALA_CHEIA', `A sala já tem ${LIMITES.maxJogadores} participantes.`);
    }
  }
}
