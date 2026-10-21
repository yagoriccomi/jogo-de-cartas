import {
  LIMITES,
  type ConfiguracaoPartida,
  type EstadoSala,
  type ParticipanteSala,
  type VotacaoEspera,
} from '@fodinha/shared';
import type { GeradorAleatorio } from './aleatoriedade';
import { validarConfiguracao } from './configuracao';
import { ErroDeRegra } from './erros';
import { Partida } from './partida';

const MS_POR_SEGUNDO = 1000;
export interface Participante {
  readonly id: string;
  readonly apelido: string;
  readonly ehBot: boolean;
  conectado: boolean;
  /** Saiu ou foi expulso no meio da rodada: some da sala quando a rodada terminar. */
  saindo: boolean;
  /** Só humanos têm token; é o que permite reassumir o assento após queda de conexão. */
  readonly tokenSessao: string | null;
  /** Identificador do navegador (só humanos): base do banimento e da volta do criador. */
  readonly dispositivoId: string | null;
}

/** Quem está com o resumo das regras aberto e desde quando (relógio do condutor). */
export interface LeituraDasRegras {
  readonly jogadorId: string;
  readonly desde: number;
}

interface Votacao {
  readonly desde: number;
  readonly votos: Map<string, boolean>;
}

/** Resultado de uma expulsão, para a infraestrutura avisar e desconectar o expulso. */
export interface Expulsao {
  readonly expulsoId: string;
  readonly eraHumano: boolean;
}

export interface OpcoesDaSala {
  /** Cenários de teste ultrapassam o limite normal de bots. */
  readonly maxBots?: number;
}

/** Sala de espera + partida corrente. Concentra as regras de quem pode fazer o quê. */
export class Sala {
  private readonly participantes: Participante[] = [];
  private readonly banidos = new Set<string>();
  private readonly votacoes = new Map<string, Votacao>();
  private readonly dispositivoDoCriador: string | null;
  private criadorId: string;
  private anfitriaoId: string;
  private configuracao: ConfiguracaoPartida;
  private partidaAtual: Partida | null = null;
  private pausaDoDono = false;
  private leitura: LeituraDasRegras | null = null;
  /** Quem já usou a pausa de leitura nesta partida: ela não vira pausa à vontade. */
  private readonly jaLeram = new Set<string>();
  private readonly maxBots: number;

  constructor(
    readonly codigo: string,
    criador: Participante,
    configuracao: ConfiguracaoPartida,
    opcoes: OpcoesDaSala = {},
  ) {
    this.maxBots = opcoes.maxBots ?? LIMITES.maxBots;
    this.configuracao = validarConfiguracao(configuracao);
    this.participantes.push(criador);
    this.anfitriaoId = criador.id;
    this.criadorId = criador.id;
    this.dispositivoDoCriador = criador.dispositivoId;
  }

  /** `null` = sem limite: ninguém age pelo humano que demora. */
  get prazoDaVezMs(): number | null {
    const segundos = this.configuracao.prazoDaVezSegundos;
    return segundos === null ? null : segundos * MS_POR_SEGUNDO;
  }

  get partida(): Partida | null {
    return this.partidaAtual;
  }

  get emPartida(): boolean {
    return this.partidaAtual !== null && this.partidaAtual.faseAtual !== 'encerrada';
  }

  /** Com votação aberta nada anda: sem prazo da vez, sem jogada de bot, sem jogada humana. */
  get pausada(): boolean {
    return this.votacoes.size > 0 || this.pausadaPeloDono || this.leituraDasRegras !== null;
  }

  /** O dono congelou a mesa: dura até ele retomar (ou a partida acabar/reiniciar). */
  get pausadaPeloDono(): boolean {
    return this.pausaDoDono && this.emPartida;
  }

  get leituraDasRegras(): LeituraDasRegras | null {
    return this.emPartida ? this.leitura : null;
  }

  get todos(): readonly Participante[] {
    return this.participantes;
  }

  get humanosConectados(): number {
    return this.participantes.filter((p) => !p.ehBot && !p.saindo && p.conectado).length;
  }

  /** Humanos que ainda pertencem à sala (conectados ou com queda temporária). */
  get humanosPresentes(): number {
    return this.participantes.filter((p) => !p.ehBot && !p.saindo).length;
  }

  participante(id: string): Participante | undefined {
    return this.participantes.find((p) => p.id === id);
  }

  participantePorToken(token: string): Participante | undefined {
    return this.participantes.find((p) => p.tokenSessao === token && !p.saindo);
  }

  /** Em partida, quem chega senta na próxima rodada (premissa P7). */
  adicionarHumano(participante: Participante): void {
    if (participante.dispositivoId && this.banidos.has(participante.dispositivoId)) {
      throw new ErroDeRegra('BANIDO', 'Você foi expulso desta sala pelo dono.');
    }
    this.exigirVaga();
    if (this.emPartida) this.partidaAtual?.adicionarJogador(participante.id);
    this.participantes.push(participante);
    // Premissa R4: o criador recupera o posto ao voltar pelo mesmo navegador — mas só se ele
    // de fato saiu; uma segunda aba do criador ainda presente não rouba o posto.
    const ehOCriadorDeVolta =
      !!participante.dispositivoId && participante.dispositivoId === this.dispositivoDoCriador;
    if (ehOCriadorDeVolta && !this.criadorPresente()) {
      this.anfitriaoId = participante.id;
      this.criadorId = participante.id;
    }
  }

  adicionarBot(solicitanteId: string, bot: Participante): void {
    this.exigirAnfitriao(solicitanteId);
    this.exigirLobby();
    this.exigirVaga();
    if (this.ativos().filter((p) => p.ehBot).length >= this.maxBots) {
      throw new ErroDeRegra('SALA_CHEIA', `A sala já tem o máximo de ${this.maxBots} bots.`);
    }
    this.participantes.push(bot);
  }

  /** Humano expulso fica banido pelo navegador; bot é apenas removido. */
  expulsar(solicitanteId: string, alvoId: string): Expulsao {
    this.exigirAnfitriao(solicitanteId);
    if (alvoId === solicitanteId) {
      throw new ErroDeRegra('ENTRADA_INVALIDA', 'Para sair da sala, use a opção de sair.');
    }
    const alvo = this.exigirParticipante(alvoId);
    if (alvo.saindo) throw new ErroDeRegra('ENTRADA_INVALIDA', 'Esse jogador já está saindo.');
    if (alvo.dispositivoId) this.banidos.add(alvo.dispositivoId);
    this.desligar(alvo);
    return { expulsoId: alvo.id, eraHumano: !alvo.ehBot };
  }

  configurar(solicitanteId: string, configuracao: ConfiguracaoPartida): void {
    this.exigirAnfitriao(solicitanteId);
    this.exigirLobby();
    this.configuracao = validarConfiguracao(configuracao);
  }

  /** Diferente das outras opções, vale no meio da partida: só muda o que os eliminados enxergam. */
  definirMortosVeemCartas(solicitanteId: string, mortosVeemCartas: boolean): void {
    this.exigirAnfitriao(solicitanteId);
    this.configuracao = { ...this.configuracao, mortosVeemCartas };
    this.partidaAtual?.definirMortosVeemCartas(mortosVeemCartas);
  }

  iniciarPartida(
    solicitanteId: string,
    gerarAleatorio: GeradorAleatorio,
    cartasNaPrimeiraRodada?: number,
  ): Partida {
    this.exigirAnfitriao(solicitanteId);
    this.exigirLobby();
    return this.comecarPartida(gerarAleatorio, cartasNaPrimeiraRodada);
  }

  /** Volta à rodada 1 com vidas cheias para todos — inclusive eliminados e quem esperava sentar. */
  reiniciar(solicitanteId: string, gerarAleatorio: GeradorAleatorio): Partida {
    this.exigirAnfitriao(solicitanteId);
    if (!this.partidaAtual) {
      throw new ErroDeRegra('ENTRADA_INVALIDA', 'Ainda não há partida para reiniciar.');
    }
    return this.comecarPartida(gerarAleatorio);
  }

  pausar(solicitanteId: string): void {
    this.exigirAnfitriao(solicitanteId);
    if (!this.emPartida) {
      throw new ErroDeRegra('ENTRADA_INVALIDA', 'Não há partida em andamento para pausar.');
    }
    this.pausaDoDono = true;
  }

  retomar(solicitanteId: string): void {
    this.exigirAnfitriao(solicitanteId);
    this.pausaDoDono = false;
  }

  /**
   * O novato abriu o resumo das regras: a mesa inteira espera. Uma vez por jogador por partida e
   * um leitor por vez, para ninguém usar a leitura como pausa sem fim.
   */
  comecarLeituraDasRegras(jogadorId: string, agora: number): void {
    const participante = this.exigirParticipante(jogadorId);
    if (participante.ehBot || !this.emPartida || !this.partidaAtual?.estaJogando(jogadorId)) {
      throw new ErroDeRegra(
        'ENTRADA_INVALIDA',
        'Só quem está jogando pode pausar para ler as regras.',
      );
    }
    if (this.jaLeram.has(jogadorId)) {
      throw new ErroDeRegra('ENTRADA_INVALIDA', 'Você já pausou para ler as regras nesta partida.');
    }
    if (this.leitura) {
      throw new ErroDeRegra('ENTRADA_INVALIDA', 'Outro jogador está lendo as regras agora.');
    }
    this.jaLeram.add(jogadorId);
    this.leitura = { jogadorId, desde: agora };
  }

  /** Idempotente: fechar duas vezes (ou depois do tempo esgotado) não é erro. */
  encerrarLeituraDasRegras(jogadorId: string): void {
    if (this.leitura?.jogadorId === jogadorId) this.leitura = null;
  }

  /** Saída voluntária: no meio da rodada, um bot termina por ele e o assento some depois. */
  sair(participanteId: string): void {
    this.desligar(this.exigirParticipante(participanteId));
  }

  marcarConexao(participanteId: string, conectado: boolean): void {
    this.exigirParticipante(participanteId).conectado = conectado;
    if (conectado) this.votacoes.delete(participanteId);
    // Quem caiu não está lendo: a mesa não fica presa esperando um diálogo que ninguém fecha.
    else this.encerrarLeituraDasRegras(participanteId);
  }

  /**
   * Humanos que estão jogando, desconectados e ainda sem votação: precisam de carência.
   * Inclui quem caiu no lobby e foi sentado (início, reinício ou entrada no meio) já desconectado.
   */
  ausentesSemVotacao(): string[] {
    return this.ativos()
      .filter((p) => !p.ehBot && !p.conectado && !this.votacoes.has(p.id))
      .filter((p) => this.emPartida && !!this.partidaAtual?.estaJogando(p.id))
      .map((p) => p.id);
  }

  /** Abre "Deseja esperar o retorno de X?" para quem caiu e ainda está jogando. */
  abrirVotacao(ausenteId: string, agora: number): boolean {
    if (!this.ausentesSemVotacao().includes(ausenteId)) return false;
    this.votacoes.set(ausenteId, { desde: agora, votos: new Map() });
    return true;
  }

  votar(eleitorId: string, ausenteId: string, esperar: boolean): void {
    const votacao = this.votacoes.get(ausenteId);
    if (!votacao) throw new ErroDeRegra('ENTRADA_INVALIDA', 'Essa votação já foi encerrada.');
    if (!this.eleitoresDe(ausenteId).includes(eleitorId)) {
      throw new ErroDeRegra('SEM_PERMISSAO', 'Você não pode votar nesta espera.');
    }
    votacao.votos.set(eleitorId, esperar);
  }

  /**
   * Encerra as votações em que todos os eleitores votaram NÃO: o ausente é eliminado e um bot
   * termina a rodada dele. Sem nenhum eleitor, mas com alguém assistindo, a mesa também segue —
   * ninguém pode decidir esperar. Reavaliada sempre que o eleitorado muda.
   * Devolve quem foi eliminado.
   */
  resolverVotacoes(): string[] {
    const eliminados: string[] = [];
    const alguemAssistindo = this.ativos().some((p) => !p.ehBot && p.conectado);
    for (const [ausenteId, votacao] of this.votacoes) {
      const eleitores = this.eleitoresDe(ausenteId);
      const todosNao =
        eleitores.length > 0
          ? eleitores.every((id) => votacao.votos.get(id) === false)
          : alguemAssistindo;
      if (!todosNao) continue;
      this.votacoes.delete(ausenteId);
      this.partidaAtual?.agendarSaida(ausenteId, 'eliminar');
      eliminados.push(ausenteId);
    }
    return eliminados;
  }

  votacoesVisiveis(): VotacaoEspera[] {
    return [...this.votacoes].map(([ausenteId, votacao]) => ({
      ausenteId,
      apelido: this.participante(ausenteId)?.apelido ?? '—',
      desconectadoDesde: votacao.desde,
      votos: this.eleitoresDe(ausenteId).map((eleitorId) => ({
        eleitorId,
        esperar: votacao.votos.get(eleitorId) ?? null,
      })),
    }));
  }

  /** Tira da sala quem saiu no meio da rodada assim que a partida liberou o assento. */
  descartarQuemSaiu(): void {
    const partida = this.partidaAtual;
    const permanecem = this.participantes.filter(
      (p) => !p.saindo || (this.emPartida && !!partida?.participa(p.id)),
    );
    this.participantes.splice(0, this.participantes.length, ...permanecem);
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
        aguardandoProximaRodada: this.emPartida && !!this.partidaAtual?.aguardandoEntrada(p.id),
        saindo: p.saindo,
      })),
    };
  }

  private comecarPartida(
    gerarAleatorio: GeradorAleatorio,
    cartasNaPrimeiraRodada?: number,
  ): Partida {
    const ativos = this.ativos();
    // Valida antes de mexer no estado: um erro aqui não pode apagar quem está saindo nem votações.
    if (ativos.length < LIMITES.minJogadores) {
      throw new ErroDeRegra(
        'ENTRADA_INVALIDA',
        `São necessários pelo menos ${LIMITES.minJogadores} participantes para começar.`,
      );
    }
    const partida = Partida.iniciar({
      configuracao: this.configuracao,
      jogadorIds: ativos.map((p) => p.id),
      gerarAleatorio,
      cartasNaPrimeiraRodada,
    });
    this.participantes.splice(0, this.participantes.length, ...ativos);
    this.votacoes.clear();
    this.pausaDoDono = false;
    this.leitura = null;
    this.jaLeram.clear();
    this.partidaAtual = partida;
    return partida;
  }

  /** Saída (voluntária ou expulsão): fora de partida é imediata; em partida, ao fim da rodada. */
  private desligar(participante: Participante): void {
    this.encerrarLeituraDasRegras(participante.id);
    this.votacoes.delete(participante.id);
    for (const votacao of this.votacoes.values()) votacao.votos.delete(participante.id);

    const partida = this.partidaAtual;
    if (this.emPartida && partida) partida.agendarSaida(participante.id, 'remover');
    if (this.emPartida && partida?.participa(participante.id)) {
      participante.saindo = true;
      participante.conectado = false;
    } else {
      this.participantes.splice(this.participantes.indexOf(participante), 1);
    }
    if (participante.id === this.anfitriaoId) this.promoverNovoAnfitriao();
  }

  /**
   * Eleitores: humanos ainda jogando, exceto ausentes com votação aberta. Quem só piscou a rede
   * continua eleitor durante a própria carência — senão a queda de 2 s de quem não votou
   * fecharia a votação dos outros.
   */
  private eleitoresDe(ausenteId: string): string[] {
    return this.ativos()
      .filter((p) => !p.ehBot && p.id !== ausenteId && !this.votacoes.has(p.id))
      .filter((p) => !!this.partidaAtual?.estaJogando(p.id))
      .map((p) => p.id);
  }

  private ativos(): Participante[] {
    return this.participantes.filter((p) => !p.saindo);
  }

  private criadorPresente(): boolean {
    const criador = this.participante(this.criadorId);
    return !!criador && !criador.saindo;
  }

  /** Premissa R4: o posto vai para o humano há mais tempo na sala — de preferência conectado. */
  private promoverNovoAnfitriao(): void {
    const humanos = this.ativos().filter((p) => !p.ehBot);
    const proximo = humanos.find((p) => p.conectado) ?? humanos[0];
    if (proximo) this.anfitriaoId = proximo.id;
  }

  private exigirParticipante(participanteId: string): Participante {
    const participante = this.participante(participanteId);
    if (!participante) throw new ErroDeRegra('SEM_PERMISSAO', 'Você não está nesta sala.');
    return participante;
  }

  private exigirAnfitriao(solicitanteId: string): void {
    if (solicitanteId !== this.anfitriaoId) {
      throw new ErroDeRegra('SEM_PERMISSAO', 'Só o dono da sala pode fazer isso.');
    }
  }

  private exigirLobby(): void {
    if (this.emPartida) {
      throw new ErroDeRegra('PARTIDA_EM_ANDAMENTO', 'Há uma partida em andamento nesta sala.');
    }
  }

  private exigirVaga(): void {
    if (this.ativos().length >= LIMITES.maxJogadores) {
      throw new ErroDeRegra('SALA_CHEIA', `A sala já tem ${LIMITES.maxJogadores} participantes.`);
    }
  }
}
