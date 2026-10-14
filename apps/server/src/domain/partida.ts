import type {
  Carta,
  CartaNaMao,
  ConfiguracaoPartida,
  FasePartida,
  Jogada,
  JogadaNaMesa,
  ResultadoJogadorNaRodada,
  Valor,
  VazaGanha,
  VazaResolvida,
} from '@fodinha/shared';
import { LIMITES, NAIPES } from '@fodinha/shared';
import type { GeradorAleatorio } from './aleatoriedade';
import { montarBaralhoEmbaralhado, totalDeCartas, valoresEmJogo } from './baralho';
import { validarConfiguracao } from './configuracao';
import { ErroDeRegra } from './erros';
import { forcaDaCarta, valorDaManilha } from './forca';
import {
  maxCartasPorJogador,
  palpiteProibidoDoPe,
  proximaQuantidadeDeCartas,
  vidasPerdidas,
} from './rodadas';
import { organizarMesa, resolverVaza } from './vaza';

interface JogadorNaPartida {
  readonly id: string;
  vidas: number;
  eliminado: boolean;
  mao: Carta[];
  palpite: number | null;
  vazasGanhas: VazaGanha[];
}

/**
 * `eliminar`: votado para fora — continua na mesa como espectador (volta num reinício).
 * `remover`: saiu ou foi expulso — o assento some entre as rodadas.
 */
export type DestinoDaSaida = 'eliminar' | 'remover';

/** Projeção do jogador para quem observa; dados de sala (apelido, bot, conexão) vêm da aplicação. */
export interface JogadorNaVisao {
  readonly id: string;
  readonly vidas: number;
  readonly eliminado: boolean;
  readonly palpite: number | null;
  readonly vazasFeitas: number;
  readonly vazasGanhas: readonly VazaGanha[];
  readonly cartasNaMao: number;
  readonly cartaNaTesta: Carta | null;
  readonly saiAoFimDaRodada: boolean;
}

export interface VisaoDaPartida {
  readonly configuracao: ConfiguracaoPartida;
  readonly fase: FasePartida;
  readonly numeroRodada: number;
  readonly cartasPorJogador: number;
  readonly rodadaCega: boolean;
  readonly vira: Carta | null;
  readonly manilha: Valor | null;
  readonly jogadores: readonly JogadorNaVisao[];
  readonly idDoPe: string | null;
  readonly idDoPrimeiro: string | null;
  readonly idDaVez: string | null;
  readonly minhaMao: readonly CartaNaMao[];
  readonly mesa: readonly JogadaNaMesa[];
  readonly ultimaVaza: VazaResolvida | null;
  readonly palpiteProibido: number | null;
  readonly resultadoRodada: readonly ResultadoJogadorNaRodada[] | null;
  readonly vencedores: readonly string[];
}

export interface PrevisaoDaRodada {
  readonly cartasPorJogador: number;
  readonly idDoPrimeiro: string;
}

export interface NovaPartida {
  readonly configuracao: ConfiguracaoPartida;
  /** Ordem dos assentos à mesa (sentido horário). */
  readonly jogadorIds: readonly string[];
  readonly gerarAleatorio: GeradorAleatorio;
}

/**
 * Agregado que guarda todo o estado de uma partida e aplica as regras da Fodinha.
 * Puro: sem I/O, sem relógio — o tempo (prazos, pausas) é responsabilidade da aplicação.
 */
export class Partida {
  private readonly jogadores: JogadorNaPartida[];
  private readonly valores: readonly Valor[];
  private readonly saidasPendentes = new Map<string, DestinoDaSaida>();
  private entrantes: string[] = [];
  private fase: FasePartida = 'palpites';
  private numeroRodada = 0;
  private cartasPorJogador = 0;
  private vira: Carta | null = null;
  private manilha: Valor | null = null;
  private indiceDoPe: number;
  private indiceDaVez: number | null = null;
  private indiceQueAbriuVaza = 0;
  private mesa: Jogada[] = [];
  private ultimaVaza: VazaResolvida | null = null;
  private resultadoRodada: ResultadoJogadorNaRodada[] | null = null;
  private vencedores: string[] = [];

  private constructor(
    private readonly configuracao: ConfiguracaoPartida,
    jogadorIds: readonly string[],
    private readonly gerarAleatorio: GeradorAleatorio,
  ) {
    this.valores = valoresEmJogo(configuracao.incluirOitoNoveDez);
    this.jogadores = jogadorIds.map((id) => this.novoJogador(id, configuracao.vidasIniciais));
    this.indiceDoPe = Math.floor(gerarAleatorio() * jogadorIds.length);
  }

  static iniciar({ configuracao, jogadorIds, gerarAleatorio }: NovaPartida): Partida {
    const configuracaoValida = validarConfiguracao(configuracao);
    if (jogadorIds.length < LIMITES.minJogadores || jogadorIds.length > LIMITES.maxJogadores) {
      throw new ErroDeRegra(
        'ENTRADA_INVALIDA',
        `A partida precisa de ${LIMITES.minJogadores} a ${LIMITES.maxJogadores} jogadores.`,
      );
    }
    if (new Set(jogadorIds).size !== jogadorIds.length) {
      throw new ErroDeRegra('ENTRADA_INVALIDA', 'Jogadores repetidos na partida.');
    }
    const partida = new Partida(configuracaoValida, jogadorIds, gerarAleatorio);
    partida.distribuirRodada();
    return partida;
  }

  get faseAtual(): FasePartida {
    return this.fase;
  }

  get idDaVez(): string | null {
    return this.indiceDaVez === null ? null : this.jogador(this.indiceDaVez).id;
  }

  get rodadaCega(): boolean {
    return this.cartasPorJogador === 1;
  }

  /** Tem assento à mesa (eliminado ou não). Quem aguarda a próxima rodada ainda não participa. */
  participa(jogadorId: string): boolean {
    return this.jogadores.some((jogador) => jogador.id === jogadorId);
  }

  /** Está sentado, não foi eliminado e não tem saída marcada: é quem pode votar e ser esperado. */
  estaJogando(jogadorId: string): boolean {
    const jogador = this.jogadores.find((j) => j.id === jogadorId);
    return !!jogador && !jogador.eliminado && !this.saidasPendentes.has(jogadorId);
  }

  aguardandoEntrada(jogadorId: string): boolean {
    return this.entrantes.includes(jogadorId);
  }

  /** Quem tem saída marcada é conduzido por um bot até a rodada terminar. */
  saiAoFimDaRodada(jogadorId: string): boolean {
    return this.saidasPendentes.has(jogadorId);
  }

  adicionarJogador(jogadorId: string): void {
    if (this.fase === 'encerrada') {
      throw new ErroDeRegra('PARTIDA_EM_ANDAMENTO', 'A partida já terminou.');
    }
    if (this.participa(jogadorId) || this.aguardandoEntrada(jogadorId)) {
      throw new ErroDeRegra('ENTRADA_INVALIDA', 'Esse jogador já está na partida.');
    }
    this.entrantes.push(jogadorId);
  }

  /**
   * Marca a saída de um jogador. Ela só se efetiva entre rodadas, para não desfazer palpites
   * e vazas já em jogo (premissa R2: um bot termina a rodada por ele).
   */
  agendarSaida(jogadorId: string, destino: DestinoDaSaida): void {
    if (this.aguardandoEntrada(jogadorId)) {
      this.entrantes = this.entrantes.filter((id) => id !== jogadorId);
      return;
    }
    if (this.fase === 'encerrada' || !this.participa(jogadorId)) return;
    const atual = this.saidasPendentes.get(jogadorId);
    // "Remover" vence "eliminar": quem foi votado para fora e depois saiu deve sumir da mesa.
    if (atual === 'remover') return;
    this.saidasPendentes.set(jogadorId, destino);
    if (this.fase === 'fim_de_rodada') this.efetivarSaidas();
  }

  palpitar(jogadorId: string, quantidade: number): void {
    if (this.fase !== 'palpites') {
      throw new ErroDeRegra('PALPITE_INVALIDO', 'Não é hora de palpitar.');
    }
    const indice = this.exigirVez(jogadorId);
    if (!this.palpitesPermitidos(jogadorId).includes(quantidade)) {
      throw new ErroDeRegra(
        'PALPITE_INVALIDO',
        this.motivoDoPalpiteInvalido(jogadorId, quantidade),
      );
    }

    this.jogador(indice).palpite = quantidade;
    if (indice !== this.indiceDoPe) {
      this.indiceDaVez = this.proximoVivo(indice);
      return;
    }
    this.fase = 'jogando';
    this.indiceQueAbriuVaza = this.proximoVivo(this.indiceDoPe);
    this.indiceDaVez = this.indiceQueAbriuVaza;
    if (this.rodadaCega) this.revelarRodadaCega();
  }

  /**
   * Na rodada cega não há o que decidir na hora de jogar (ninguém vê a própria carta): assim que
   * os palpites terminam, todas as cartas vão à mesa em ordem e a vaza é resolvida.
   */
  private revelarRodadaCega(): void {
    while (this.fase === 'jogando') {
      const idDaVez = this.idDaVez as string;
      const [carta] = this.cartasNaMaoDe(idDaVez);
      this.jogarCarta(idDaVez, (carta as Carta).id);
    }
  }

  jogarCarta(jogadorId: string, cartaId: string): void {
    if (this.fase !== 'jogando') {
      throw new ErroDeRegra('JOGADA_INVALIDA', 'Não é hora de jogar cartas.');
    }
    const indice = this.exigirVez(jogadorId);
    const jogador = this.jogador(indice);
    const posicaoNaMao = jogador.mao.findIndex((carta) => carta.id === cartaId);
    if (posicaoNaMao === -1) {
      throw new ErroDeRegra('JOGADA_INVALIDA', 'Essa carta não está na sua mão.');
    }

    const [carta] = jogador.mao.splice(posicaoNaMao, 1) as [Carta];
    this.mesa.push({ jogadorId, carta });

    if (this.mesa.length < this.vivos().length) {
      this.indiceDaVez = this.proximoVivo(indice);
      return;
    }
    this.fecharVaza();
  }

  /** Chamado pela aplicação depois da pausa de exibição do resultado da rodada. */
  iniciarProximaRodada(): void {
    if (this.fase !== 'fim_de_rodada') {
      throw new ErroDeRegra('JOGADA_INVALIDA', 'A rodada atual ainda não terminou.');
    }
    const idDoProximoPe = this.jogador(this.proximoVivo(this.indiceDoPe)).id;
    this.retirarAssentosRemovidos();
    this.sentarEntrantes();

    if (this.vivos().length < LIMITES.minJogadores) {
      this.encerrar(this.vivos());
      return;
    }
    const indiceDoProximoPe = this.jogadores.findIndex((j) => j.id === idDoProximoPe);
    // O pé escolhido pode ter acabado de sair; nesse caso o pé passa a quem estava à esquerda dele.
    this.indiceDoPe =
      indiceDoProximoPe === -1 || this.jogador(indiceDoProximoPe).eliminado
        ? this.proximoVivo(Math.max(indiceDoProximoPe, 0) - 1)
        : indiceDoProximoPe;
    this.distribuirRodada();
  }

  /**
   * No intervalo entre rodadas: quantas cartas a próxima terá e quem a abre, já considerando
   * quem sai e quem senta. Espelha `iniciarProximaRodada` sem alterar o estado.
   */
  previsaoDaProximaRodada(): PrevisaoDaRodada | null {
    if (this.fase !== 'fim_de_rodada') return null;
    const removidos = new Set(
      [...this.saidasPendentes].filter(([, destino]) => destino === 'remover').map(([id]) => id),
    );
    const assentos = [
      ...this.jogadores
        .filter((jogador) => !removidos.has(jogador.id))
        .map((jogador) => ({ id: jogador.id, vivo: !jogador.eliminado })),
      ...this.entrantes.map((id) => ({ id, vivo: true })),
    ];
    const vivos = assentos.filter((assento) => assento.vivo).length;
    if (vivos < LIMITES.minJogadores) return null;

    const idDoProximoPe = this.jogador(this.proximoVivo(this.indiceDoPe)).id;
    const indiceDoPe = Math.max(
      0,
      assentos.findIndex((assento) => assento.id === idDoProximoPe),
    );
    let indiceDoPrimeiro = indiceDoPe;
    do {
      indiceDoPrimeiro = (indiceDoPrimeiro + 1) % assentos.length;
    } while (!assentos[indiceDoPrimeiro]?.vivo && indiceDoPrimeiro !== indiceDoPe);

    const maximo = maxCartasPorJogador(totalDeCartas(this.configuracao), vivos);
    return {
      cartasPorJogador: proximaQuantidadeDeCartas(this.cartasPorJogador, maximo),
      idDoPrimeiro: (assentos[indiceDoPrimeiro] as { id: string }).id,
    };
  }

  palpitesPermitidos(jogadorId: string): number[] {
    const indice = this.indiceDe(jogadorId);
    const proibido = indice === this.indiceDoPe ? this.palpiteProibidoAtual() : null;
    return Array.from({ length: this.cartasPorJogador + 1 }, (_, quantidade) => quantidade).filter(
      (quantidade) => quantidade !== proibido,
    );
  }

  cartasNaMaoDe(jogadorId: string): readonly Carta[] {
    return this.jogador(this.indiceDe(jogadorId)).mao;
  }

  /** Visão sem nenhuma mão revelada: para espectadores ou para jogadores eliminados. */
  visaoPara(jogadorId: string | null): VisaoDaPartida {
    const indiceObservador = jogadorId === null ? null : this.indiceDe(jogadorId);
    const observador = indiceObservador === null ? null : this.jogador(indiceObservador);
    const rodadaEmJogo = this.fase === 'palpites' || this.fase === 'jogando';

    return {
      configuracao: this.configuracao,
      fase: this.fase,
      numeroRodada: this.numeroRodada,
      cartasPorJogador: this.cartasPorJogador,
      rodadaCega: this.rodadaCega,
      vira: this.vira,
      manilha: this.manilha,
      jogadores: this.jogadores.map((jogador) => ({
        id: jogador.id,
        vidas: jogador.vidas,
        eliminado: jogador.eliminado,
        palpite: jogador.palpite,
        vazasFeitas: jogador.vazasGanhas.length,
        vazasGanhas: [...jogador.vazasGanhas],
        cartasNaMao: jogador.mao.length,
        cartaNaTesta: this.cartaNaTestaVistaPor(jogador, observador),
        saiAoFimDaRodada: this.saidasPendentes.has(jogador.id),
      })),
      idDoPe: this.fase === 'encerrada' ? null : this.jogador(this.indiceDoPe).id,
      idDoPrimeiro: rodadaEmJogo ? this.jogador(this.proximoVivo(this.indiceDoPe)).id : null,
      idDaVez: this.idDaVez,
      minhaMao: observador ? this.maoVistaPeloDono(observador) : [],
      mesa: organizarMesa(this.mesa, this.manilha as Valor, this.valores),
      ultimaVaza: this.ultimaVaza,
      palpiteProibido:
        observador && indiceObservador === this.indiceDoPe && this.fase === 'palpites'
          ? this.palpiteProibidoAtual()
          : null,
      resultadoRodada: this.resultadoRodada,
      vencedores: [...this.vencedores],
    };
  }

  private novoJogador(id: string, vidas: number): JogadorNaPartida {
    return { id, vidas, eliminado: false, mao: [], palpite: null, vazasGanhas: [] };
  }

  private distribuirRodada(): void {
    const vivos = this.vivos();
    const maximo = maxCartasPorJogador(totalDeCartas(this.configuracao), vivos.length);
    const anterior = this.numeroRodada === 0 ? null : this.cartasPorJogador;
    this.cartasPorJogador = proximaQuantidadeDeCartas(anterior, maximo);
    this.numeroRodada += 1;

    const monte = montarBaralhoEmbaralhado(this.configuracao, this.gerarAleatorio);
    for (const jogador of this.jogadores) {
      jogador.mao = [];
      jogador.palpite = null;
      jogador.vazasGanhas = [];
    }
    // Distribui uma carta por vez a partir da esquerda do pé, como numa mesa real.
    let indice = this.indiceDoPe;
    for (
      let distribuidas = 0;
      distribuidas < this.cartasPorJogador * vivos.length;
      distribuidas++
    ) {
      indice = this.proximoVivo(indice);
      this.jogador(indice).mao.push(monte.pop() as Carta);
    }
    this.vira = monte.pop() as Carta;
    this.manilha = valorDaManilha(this.vira.valor, this.valores);

    this.mesa = [];
    this.fase = 'palpites';
    this.indiceDaVez = this.proximoVivo(this.indiceDoPe);
  }

  private fecharVaza(): void {
    const jogadas = this.mesa;
    const vencedorId = resolverVaza(jogadas, this.manilha as Valor, this.valores);
    this.ultimaVaza = {
      jogadas: organizarMesa(jogadas, this.manilha as Valor, this.valores),
      vencedorId,
    };
    this.mesa = [];

    // Vaza anulada: quem abriu continua abrindo (premissa P4 do plano).
    const indiceQueAbre = vencedorId === null ? this.indiceQueAbriuVaza : this.indiceDe(vencedorId);
    if (vencedorId !== null) {
      const vencedora = jogadas.find((jogada) => jogada.jogadorId === vencedorId) as Jogada;
      this.jogador(indiceQueAbre).vazasGanhas.push({
        cartaVencedora: vencedora.carta,
        quantidadeDeCartas: jogadas.length,
      });
    }

    if (this.jogador(indiceQueAbre).mao.length > 0) {
      this.indiceQueAbriuVaza = indiceQueAbre;
      this.indiceDaVez = indiceQueAbre;
      return;
    }
    this.encerrarRodada();
  }

  private encerrarRodada(): void {
    const participantes = this.vivos();
    this.resultadoRodada = participantes.map((jogador) => {
      const palpite = jogador.palpite as number;
      const perdidas = vidasPerdidas(palpite, jogador.vazasGanhas.length);
      jogador.vidas -= perdidas;
      jogador.eliminado = jogador.vidas <= 0;
      return {
        jogadorId: jogador.id,
        palpite,
        vazasFeitas: jogador.vazasGanhas.length,
        vidasPerdidas: perdidas,
      };
    });
    this.indiceDaVez = null;
    this.fase = 'fim_de_rodada';
    this.efetivarSaidas(participantes);
  }

  /**
   * Quem tinha saída marcada deixa o jogo agora. Se sobrar no máximo um jogador e ninguém
   * estiver esperando para sentar, a partida termina.
   */
  private efetivarSaidas(participantesDaRodada: readonly JogadorNaPartida[] = this.vivos()): void {
    const quemSaiu = new Set(this.saidasPendentes.keys());
    for (const [id, destino] of this.saidasPendentes) {
      this.jogador(this.indiceDe(id)).eliminado = true;
      if (destino === 'eliminar') this.saidasPendentes.delete(id);
    }
    if (this.vivos().length + this.entrantes.length > 1) return;

    // Quem saiu não vence — a menos que todos tenham saído, aí vale quem ficou com mais vidas.
    const quemFicou = participantesDaRodada.filter((j) => !quemSaiu.has(j.id));
    const candidatos = quemFicou.length > 0 ? quemFicou : participantesDaRodada;
    this.encerrar(this.vivos().length > 0 ? this.vivos() : candidatos);
  }

  /** Um sobrevivente vence; se todos zeraram juntos, vence quem ficou menos negativo (P8). */
  private encerrar(candidatos: readonly JogadorNaPartida[]): void {
    this.fase = 'encerrada';
    this.indiceDaVez = null;
    if (candidatos.length === 0) {
      this.vencedores = [];
      return;
    }
    const maximo = Math.max(...candidatos.map((jogador) => jogador.vidas));
    this.vencedores = candidatos.filter((j) => j.vidas === maximo).map((j) => j.id);
  }

  private retirarAssentosRemovidos(): void {
    for (const [id, destino] of this.saidasPendentes) {
      if (destino !== 'remover') continue;
      this.jogadores.splice(this.indiceDe(id), 1);
      this.saidasPendentes.delete(id);
    }
  }

  /** Quem entra no meio recebe a vida do jogador vivo com mais vidas e senta no fim da mesa. */
  private sentarEntrantes(): void {
    if (this.entrantes.length === 0) return;
    const vidasDosVivos = this.vivos().map((jogador) => jogador.vidas);
    const maisVidas =
      vidasDosVivos.length > 0 ? Math.max(...vidasDosVivos) : this.configuracao.vidasIniciais;
    for (const id of this.entrantes) this.jogadores.push(this.novoJogador(id, maisVidas));
    this.entrantes = [];
  }

  private palpiteProibidoAtual(): number | null {
    const somaDosOutros = this.jogadores
      .filter((_, indice) => indice !== this.indiceDoPe)
      .reduce((soma, jogador) => soma + (jogador.palpite ?? 0), 0);
    return palpiteProibidoDoPe(somaDosOutros, this.cartasPorJogador);
  }

  private motivoDoPalpiteInvalido(jogadorId: string, quantidade: number): string {
    if (!Number.isInteger(quantidade) || quantidade < 0 || quantidade > this.cartasPorJogador) {
      return `O palpite deve ser um número inteiro entre 0 e ${this.cartasPorJogador}.`;
    }
    const ehPe = this.indiceDe(jogadorId) === this.indiceDoPe;
    return ehPe
      ? `Como pé, você não pode palpitar ${quantidade}: a soma dos palpites fecharia com o número de cartas.`
      : 'Palpite inválido.';
  }

  private cartaNaTestaVistaPor(
    jogador: JogadorNaPartida,
    observador: JogadorNaPartida | null,
  ): Carta | null {
    if (!this.rodadaCega || jogador === observador) return null;
    return jogador.mao[0] ?? null;
  }

  /** Mão ordenada da mais forte para a mais fraca; empate de valor desempata pelo naipe. */
  private maoVistaPeloDono(dono: JogadorNaPartida): CartaNaMao[] {
    if (this.rodadaCega) return dono.mao.map((carta) => ({ id: carta.id, oculta: true as const }));
    const forca = (carta: Carta) =>
      forcaDaCarta(carta, this.manilha as Valor, this.valores) * NAIPES.length +
      NAIPES.indexOf(carta.naipe);
    return [...dono.mao].sort((a, b) => forca(b) - forca(a));
  }

  private exigirVez(jogadorId: string): number {
    const indice = this.indiceDe(jogadorId);
    if (indice !== this.indiceDaVez) {
      throw new ErroDeRegra('FORA_DA_VEZ', 'Não é a sua vez.');
    }
    return indice;
  }

  private indiceDe(jogadorId: string): number {
    const indice = this.jogadores.findIndex((jogador) => jogador.id === jogadorId);
    if (indice === -1) {
      throw new ErroDeRegra('SEM_PERMISSAO', 'Você não está nesta partida.');
    }
    return indice;
  }

  private jogador(indice: number): JogadorNaPartida {
    return this.jogadores[indice] as JogadorNaPartida;
  }

  private vivos(): JogadorNaPartida[] {
    return this.jogadores.filter((jogador) => !jogador.eliminado);
  }

  /** Próximo assento (sentido horário) ocupado por jogador não eliminado. */
  private proximoVivo(indice: number): number {
    for (let passo = 1; passo <= this.jogadores.length; passo++) {
      const total = this.jogadores.length;
      const candidato = (((indice + passo) % total) + total) % total;
      if (!this.jogador(candidato).eliminado) return candidato;
    }
    return indice;
  }
}
