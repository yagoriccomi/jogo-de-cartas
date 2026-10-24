import { LIMITES, type ConfiguracaoPartida } from '@fodinha/shared';
import {
  proximoPasso,
  registrarMarco,
  type Etapa,
  type MarcoDaEtapa,
  type ProximoPasso,
  type TemposDaMesa,
} from './agenda';
import type { GeradorAleatorio } from './aleatoriedade';
import { PERFIL_DA_JOGADA_AUTOMATICA, sortearPerfis, type PerfilDeBot } from './bot/perfis';
import { validarConfiguracao } from './configuracao';
import {
  DECISAO_HUMANA,
  DiarioDaPartida,
  type AutorDaDecisao,
  type ParticipanteDoDiario,
} from './diario';
import { ErroDeRegra } from './erros';
import type { EstrategiasDosPerfis } from './estrategia-bot';
import { jogarAVez, type JogadaDaVez } from './jogar-a-vez';
import { Partida } from './partida';

const MS_POR_SEGUNDO = 1000;
export interface Participante {
  readonly id: string;
  readonly apelido: string;
  readonly ehBot: boolean;
  /** Estilo de jogo do bot, sorteado a cada partida; `null` nos humanos e no lobby. */
  perfilDoBot: PerfilDeBot | null;
  conectado: boolean;
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

/** Votação de espera em curso; o que cada destinatário vê dela é decidido na projeção. */
export interface VotacaoAberta {
  readonly ausenteId: string;
  readonly desde: number;
  readonly votos: readonly { readonly eleitorId: string; readonly esperar: boolean | null }[];
}

interface Votacao {
  readonly desde: number;
  readonly votos: Map<string, boolean>;
}

/**
 * O que uma mudança na sala provocou além dela mesma: ao fim de cada mutação a sala resolve as
 * votações de espera, e a aplicação registra os eliminados uma vez só.
 */
export interface Desfecho {
  readonly eliminados: readonly string[];
}

/** Resultado de uma expulsão, para a infraestrutura avisar e desconectar o expulso. */
export interface Expulsao {
  readonly expulsoId: string;
  readonly eraHumano: boolean;
}

export interface OpcoesDaSala {
  /** Cenários de teste ultrapassam o limite normal de bots. */
  readonly maxBots?: number;
  /** Mesa montada só para desenvolvimento: não entra no histórico nem nos dados de treino. */
  readonly cenarioDeTeste?: boolean;
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
  /** Desde quando a etapa em curso (vez ou fim de rodada) corre: âncora dos prazos da mesa. */
  private marco: MarcoDaEtapa | null = null;
  private diarioAtual: DiarioDaPartida | null = null;
  readonly cenarioDeTeste: boolean;

  constructor(
    readonly codigo: string,
    criador: Participante,
    configuracao: ConfiguracaoPartida,
    opcoes: OpcoesDaSala = {},
  ) {
    this.maxBots = opcoes.maxBots ?? LIMITES.maxBots;
    this.cenarioDeTeste = opcoes.cenarioDeTeste ?? false;
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

  get configuracaoAtual(): ConfiguracaoPartida {
    return this.configuracao;
  }

  ehAnfitriao(participanteId: string): boolean {
    return participanteId === this.anfitriaoId;
  }

  get partida(): Partida | null {
    return this.partidaAtual;
  }

  /** Diário da partida corrente; `null` sem partida e nos cenários de teste. */
  get diario(): DiarioDaPartida | null {
    return this.diarioAtual;
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

  /** Todos na sala, inclusive quem está saindo e ainda tem o assento até a rodada terminar. */
  get todos(): readonly Participante[] {
    return this.participantes.filter((p) => this.continuaNaSala(p));
  }

  /** Quem pertence à sala: tudo o que é de quem está saindo (votos, vaga, avisos) passa por aqui. */
  ativos(): Participante[] {
    return this.participantes.filter((p) => !this.estaSaindo(p.id));
  }

  get humanosConectados(): number {
    return this.ativos().filter((p) => !p.ehBot && p.conectado).length;
  }

  /** Humanos que ainda pertencem à sala (conectados ou com queda temporária). */
  get humanosPresentes(): number {
    return this.ativos().filter((p) => !p.ehBot).length;
  }

  participante(id: string): Participante | undefined {
    return this.todos.find((p) => p.id === id);
  }

  participanteAtivo(id: string): Participante | undefined {
    return this.ativos().find((p) => p.id === id);
  }

  participantePorToken(token: string): Participante | undefined {
    return this.ativos().find((p) => p.tokenSessao === token);
  }

  /** Saiu ou foi expulso no meio da rodada: um bot termina por ele e o assento some depois. */
  estaSaindo(id: string): boolean {
    return !!this.partidaAtual?.deixaAMesa(id);
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
  expulsar(solicitanteId: string, alvoId: string): Expulsao & Desfecho {
    this.exigirAnfitriao(solicitanteId);
    if (alvoId === solicitanteId) {
      throw new ErroDeRegra('ENTRADA_INVALIDA', 'Para sair da sala, use a opção de sair.');
    }
    const alvo = this.exigirParticipante(alvoId);
    if (this.estaSaindo(alvo.id))
      throw new ErroDeRegra('ENTRADA_INVALIDA', 'Esse jogador já está saindo.');
    if (alvo.dispositivoId) this.banidos.add(alvo.dispositivoId);
    this.desligar(alvo);
    return { expulsoId: alvo.id, eraHumano: !alvo.ehBot, ...this.restabelecer() };
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

  palpitar(jogadorId: string, quantidade: number): void {
    this.jogar(DECISAO_HUMANA, (partida) => partida.palpitar(jogadorId, quantidade));
  }

  jogarCarta(jogadorId: string, cartaId: string): void {
    this.jogar(DECISAO_HUMANA, (partida) => partida.jogarCarta(jogadorId, cartaId));
  }

  /**
   * Joga por quem tem a vez: o bot com o próprio perfil; o humano que estourou o prazo ou está
   * saindo, com o perfil neutro. Devolve a jogada para quem chama decidir a reação do bot.
   */
  jogarAVez(jogadorId: string, estrategias: EstrategiasDosPerfis): JogadaDaVez {
    const perfil = this.participante(jogadorId)?.perfilDoBot ?? PERFIL_DA_JOGADA_AUTOMATICA;
    return this.jogar(this.autorAutomatico(jogadorId, perfil), (partida) =>
      jogarAVez(partida, jogadorId, estrategias[perfil]),
    );
  }

  /** Toda jogada passa aqui: o diário guarda quem decidiu (os cenários de teste não gravam). */
  private jogar<T>(autor: AutorDaDecisao, acao: (partida: Partida) => T): T {
    const partida = this.partidaEmJogo();
    // O lance desta ação é o próximo andamento: a rodada cega revela as cartas na mesma chamada.
    const lance = partida.andamento + 1;
    const resultado = acao(partida);
    this.diarioAtual?.anotar(lance, autor);
    this.diarioAtual?.acompanhar();
    return resultado;
  }

  /** Bot joga com o próprio perfil; o humano que não agiu, com o neutro, marcado pelo motivo. */
  private autorAutomatico(jogadorId: string, perfil: PerfilDeBot): AutorDaDecisao {
    if (this.participante(jogadorId)?.ehBot) return { tipo: 'bot', perfil };
    const saindo = !!this.partidaAtual?.saiAoFimDaRodada(jogadorId);
    return { tipo: saindo ? 'saida' : 'prazo', perfil };
  }

  private descreverParaODiario(jogadorId: string): ParticipanteDoDiario {
    const participante = this.participante(jogadorId);
    if (!participante?.ehBot) return { jogadorId, tipo: 'humano', perfil: null };
    return { jogadorId, tipo: 'bot', perfil: participante.perfilDoBot };
  }

  /** Fim da exibição do resultado: distribui a rodada seguinte. */
  iniciarProximaRodada(): void {
    this.partidaEmJogo().iniciarProximaRodada();
  }

  /** Saída voluntária: no meio da rodada, um bot termina por ele e o assento some depois. */
  sair(participanteId: string): Desfecho {
    this.desligar(this.exigirParticipante(participanteId));
    return this.restabelecer();
  }

  /** Quem volta pode ser o espectador que faltava para a mesa seguir sem eleitores. */
  marcarConexao(participanteId: string, conectado: boolean): Desfecho {
    this.exigirParticipante(participanteId).conectado = conectado;
    if (conectado) this.votacoes.delete(participanteId);
    // Quem caiu não está lendo: a mesa não fica presa esperando um diálogo que ninguém fecha.
    else this.encerrarLeituraDasRegras(participanteId);
    return this.restabelecer();
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

  /**
   * Abre "Deseja esperar o retorno de X?" para quem caiu e ainda está jogando; `null` quando não
   * há o que abrir. O ausente deixa de ser eleitor, então outra votação pode se resolver junto.
   */
  abrirVotacao(ausenteId: string, agora: number): Desfecho | null {
    if (!this.ausentesSemVotacao().includes(ausenteId)) return null;
    this.votacoes.set(ausenteId, { desde: agora, votos: new Map() });
    return this.restabelecer();
  }

  votar(eleitorId: string, ausenteId: string, esperar: boolean): Desfecho {
    const votacao = this.votacoes.get(ausenteId);
    if (!votacao) throw new ErroDeRegra('ENTRADA_INVALIDA', 'Essa votação já foi encerrada.');
    if (!this.eleitoresDe(ausenteId).includes(eleitorId)) {
      throw new ErroDeRegra('SEM_PERMISSAO', 'Você não pode votar nesta espera.');
    }
    votacao.votos.set(eleitorId, esperar);
    return this.restabelecer();
  }

  /** Votações de espera em curso, com o voto (ou a falta dele) de cada eleitor. */
  votacoesAbertas(): VotacaoAberta[] {
    return [...this.votacoes].map(([ausenteId, votacao]) => ({
      ausenteId,
      desde: votacao.desde,
      votos: this.eleitoresDe(ausenteId).map((eleitorId) => ({
        eleitorId,
        esperar: votacao.votos.get(eleitorId) ?? null,
      })),
    }));
  }

  /**
   * Registra o instante da mudança que acabou de acontecer e devolve o próximo passo automático.
   * Chamado a cada mudança na sala: sem mudança de etapa, devolve sempre o mesmo instante.
   */
  reagendar(agora: number, tempos: TemposDaMesa): ProximoPasso | null {
    const etapa = this.etapaAtual();
    const pausada = this.pausada;
    this.marco = registrarMarco(this.marco, { etapa, pausada, agora });
    return proximoPasso(
      {
        etapa,
        marco: this.marco,
        leitura: this.leituraDasRegras,
        pausada,
        prazoDaVezMs: this.prazoDaVezMs,
      },
      tempos,
    );
  }

  private etapaAtual(): Etapa | null {
    const partida = this.partidaAtual;
    if (!partida) return null;
    const { andamento } = partida;
    if (partida.faseAtual === 'fim_de_rodada') {
      return { tipo: 'fimDeRodada', andamento, rodadaCega: partida.rodadaCega };
    }
    const jogadorId = partida.idDaVez;
    if (jogadorId === null) return null;
    const conduzidoPorBot =
      !!this.participante(jogadorId)?.ehBot || partida.saiAoFimDaRodada(jogadorId);
    return { tipo: 'vez', andamento, jogadorId, conduzidoPorBot };
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
    // Os perfis dependem de quantos bots vão jogar, então só saem quando a partida começa.
    const bots = ativos.filter((p) => p.ehBot);
    sortearPerfis(bots.length, gerarAleatorio).forEach((perfil, i) => {
      (bots[i] as Participante).perfilDoBot = perfil;
    });
    this.votacoes.clear();
    this.pausaDoDono = false;
    this.leitura = null;
    this.jaLeram.clear();
    // Partida nova conta o andamento do zero: o marco da anterior não pode ser confundido com ela.
    this.marco = null;
    this.partidaAtual = partida;
    this.diarioAtual = this.cenarioDeTeste
      ? null
      : new DiarioDaPartida(partida, (id) => this.descreverParaODiario(id));
    return partida;
  }

  /**
   * Invariantes que toda mutação do eleitorado ou da conexão restabelece antes de retornar:
   * votações decididas são encerradas e quem já perdeu o assento sai da lista.
   */
  private restabelecer(): Desfecho {
    const eliminados = this.resolverVotacoes();
    this.descartarQuemSaiu();
    return { eliminados };
  }

  /**
   * Encerra as votações em que todos os eleitores votaram NÃO: o ausente é eliminado e um bot
   * termina a rodada dele. Sem nenhum eleitor, mas com alguém assistindo, a mesa também segue —
   * ninguém pode decidir esperar. Devolve quem foi eliminado.
   */
  private resolverVotacoes(): string[] {
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

  /**
   * Tira da lista quem saiu no meio da rodada e a partida já liberou o assento. `todos` já os
   * esconde; o descarte só evita guardá-los até a próxima partida.
   */
  private descartarQuemSaiu(): void {
    const permanecem = this.todos;
    this.participantes.splice(0, this.participantes.length, ...permanecem);
  }

  /** Saída (voluntária ou expulsão): fora de partida é imediata; em partida, ao fim da rodada. */
  private desligar(participante: Participante): void {
    this.encerrarLeituraDasRegras(participante.id);
    this.votacoes.delete(participante.id);
    for (const votacao of this.votacoes.values()) votacao.votos.delete(participante.id);

    const partida = this.partidaAtual;
    if (this.emPartida && partida) partida.agendarSaida(participante.id, 'remover');
    if (this.emPartida && partida?.participa(participante.id)) {
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

  /** Quem saiu continua listado enquanto a partida ainda guarda o assento dele. */
  private continuaNaSala(participante: Participante): boolean {
    if (!this.estaSaindo(participante.id)) return true;
    return this.emPartida && !!this.partidaAtual?.participa(participante.id);
  }

  private criadorPresente(): boolean {
    return !!this.participanteAtivo(this.criadorId);
  }

  /** Premissa R4: o posto vai para o humano há mais tempo na sala — de preferência conectado. */
  private promoverNovoAnfitriao(): void {
    const humanos = this.ativos().filter((p) => !p.ehBot);
    const proximo = humanos.find((p) => p.conectado) ?? humanos[0];
    if (proximo) this.anfitriaoId = proximo.id;
  }

  /**
   * Única porta das jogadas, humanas ou automáticas: qualquer pausa (do dono, votação de espera,
   * leitura das regras) congela a mesa inteira, então nenhuma jogada passa enquanto ela dura.
   */
  private partidaEmJogo(): Partida {
    const partida = this.partidaAtual;
    if (!this.emPartida || !partida) {
      throw new ErroDeRegra('JOGADA_INVALIDA', 'Não há partida em andamento.');
    }
    if (this.pausada) {
      throw new ErroDeRegra('JOGO_PAUSADO', 'A partida está pausada.');
    }
    return partida;
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
