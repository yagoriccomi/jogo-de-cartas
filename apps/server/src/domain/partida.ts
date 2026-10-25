import type {
  Carta,
  ConfiguracaoPartida,
  FasePartida,
  Jogada,
  JogadaNaMesa,
  ResultadoJogadorNaRodada,
  Valor,
  VazaEmpatada,
  VazaGanha,
  VazaResolvida,
} from '@fodinha/shared';
import { LIMITES } from '@fodinha/shared';
import { embaralhar, type GeradorAleatorio } from './aleatoriedade';
import { montarBaralhoEmbaralhado, totalDeCartas, valoresEmJogo } from './baralho';
import { validarConfiguracao } from './configuracao';
import { ErroDeRegra } from './erros';
import { valorDaManilha } from './forca';
import {
  projetarPara,
  type MomentoDaVisao,
  type RetratoDaPartida,
  type VisaoDaPartida,
} from './projecao';
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

export interface PrevisaoDaRodada {
  readonly cartasPorJogador: number;
  readonly idDoPrimeiro: string;
}

/** Um lance numerado pelo `andamento` da partida: é a chave que liga o fato à decisão que o causou. */
export interface PalpiteDado {
  readonly lance: number;
  readonly jogadorId: string;
  readonly quantidade: number;
}

export interface CartaJogada {
  readonly lance: number;
  readonly jogadorId: string;
  readonly carta: Carta;
}

/** As cartas na ordem em que foram jogadas (a mesa organizada perde essa ordem). */
export interface VazaJogada {
  readonly cartas: readonly CartaJogada[];
  readonly vencedorId: string | null;
}

/** Um assento no começo da rodada; o eliminado continua à mesa, sem cartas. */
export interface JogadorDaRodada {
  readonly jogadorId: string;
  readonly vidasAntes: number;
  readonly eliminado: boolean;
  readonly mao: readonly Carta[];
}

/**
 * O que muda a visão no meio da rodada sem ser jogada: alguém passa a sair ao fim dela, ou o dono
 * troca `mortosVeemCartas`. `depoisDe` conta as ações da rodada (palpites e cartas) já feitas.
 */
export type OcorrenciaDaRodada =
  | { readonly depoisDe: number; readonly tipo: 'saida'; readonly jogadorId: string }
  | { readonly depoisDe: number; readonly tipo: 'mortosVeemCartas'; readonly valor: boolean };

type OcorrenciaSemPosicao =
  | { readonly tipo: 'saida'; readonly jogadorId: string }
  | { readonly tipo: 'mortosVeemCartas'; readonly valor: boolean };

export interface ResultadoDaRodada extends ResultadoJogadorNaRodada {
  readonly vidasDepois: number;
}

/**
 * Tudo o que aconteceu numa rodada, inclusive as mãos de todos. Vai para o diário da partida,
 * nunca a um cliente: quem decide o que cada um vê é `projetarPara`.
 */
export interface FatosDaRodada {
  readonly numero: number;
  readonly cartasPorJogador: number;
  readonly cega: boolean;
  readonly vira: Carta;
  readonly manilha: Valor;
  readonly idDoPe: string;
  /** A opção no começo da rodada; trocas no meio dela vão para `ocorrencias`. */
  readonly mortosVeemCartas: boolean;
  /** Todos os assentos, na ordem da mesa. */
  readonly jogadores: readonly JogadorDaRodada[];
  readonly palpites: readonly PalpiteDado[];
  readonly vazas: readonly VazaJogada[];
  readonly ocorrencias: readonly OcorrenciaDaRodada[];
  readonly resultado: readonly ResultadoDaRodada[];
}

interface RodadaEmMontagem {
  readonly fatos: Omit<FatosDaRodada, 'palpites' | 'vazas' | 'ocorrencias' | 'resultado'>;
  readonly palpites: PalpiteDado[];
  readonly vazas: VazaJogada[];
  readonly ocorrencias: OcorrenciaDaRodada[];
  cartasDaVaza: CartaJogada[];
}

/**
 * Uma rodada reposta a partir do diário, no instante em que as cartas acabaram de ser dadas. O que
 * a visão mostra e vem de antes da rodada (a última vaza e o resultado anterior) chega pronto.
 */
export interface RodadaParaReencenar {
  readonly configuracao: ConfiguracaoPartida;
  readonly numero: number;
  readonly cartasPorJogador: number;
  readonly vira: Carta;
  readonly idDoPe: string;
  readonly jogadores: readonly JogadorDaRodada[];
  readonly ultimaVaza: VazaResolvida | null;
  readonly resultadoAnterior: readonly ResultadoJogadorNaRodada[] | null;
}

// A reencenação recebe as mãos prontas: sortear algo nela seria um defeito.
const SEM_SORTEIO: GeradorAleatorio = () => {
  throw new Error('A reencenação de uma rodada não sorteia nada.');
};

function novoJogador(id: string, vidas: number): JogadorNaPartida {
  return { id, vidas, eliminado: false, mao: [], palpite: null, vazasGanhas: [] };
}

export interface NovaPartida {
  readonly configuracao: ConfiguracaoPartida;
  /** Ordem dos assentos à mesa (sentido horário). */
  readonly jogadorIds: readonly string[];
  readonly gerarAleatorio: GeradorAleatorio;
  /** Só para cenários de teste: a primeira rodada já começa com várias cartas (limitado ao máximo). */
  readonly cartasNaPrimeiraRodada?: number;
}

/**
 * Agregado que guarda todo o estado de uma partida e aplica as regras da Fodinha.
 * Puro: sem I/O, sem relógio — o tempo (prazos, pausas) é responsabilidade da aplicação.
 */
export class Partida {
  private readonly jogadores: JogadorNaPartida[];
  private readonly valores: readonly Valor[];
  private readonly saidasPendentes = new Map<string, DestinoDaSaida>();
  /** Assentos já retirados: a sala ainda precisa saber que essas pessoas saíram. */
  private readonly assentosRetirados = new Set<string>();
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
  private vazasEmpatadas: VazaEmpatada[] = [];
  private resultadoRodada: ResultadoJogadorNaRodada[] | null = null;
  private vencedores: string[] = [];
  private acoes = 0;
  private rodadaEmMontagem: RodadaEmMontagem | null = null;
  private ultimaRodadaEncerrada: FatosDaRodada | null = null;

  private constructor(
    private configuracao: ConfiguracaoPartida,
    jogadores: JogadorNaPartida[],
    indiceDoPe: number,
    private readonly gerarAleatorio: GeradorAleatorio,
    private readonly cartasNaPrimeiraRodada: number | null,
  ) {
    this.valores = valoresEmJogo(configuracao.incluirOitoNoveDez);
    this.jogadores = jogadores;
    this.indiceDoPe = indiceDoPe;
  }

  static iniciar({
    configuracao,
    jogadorIds,
    gerarAleatorio,
    cartasNaPrimeiraRodada,
  }: NovaPartida): Partida {
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
    // Lugares sorteados a cada partida (e a cada reinício): a ordem de chegada na sala não decide
    // quem senta ao lado de quem. O primeiro pé também é sorteado; a mão é sempre o seguinte.
    const jogadores = embaralhar(jogadorIds, gerarAleatorio).map((id) =>
      novoJogador(id, configuracaoValida.vidasIniciais),
    );
    const indiceDoPe = Math.floor(gerarAleatorio() * jogadorIds.length);
    const partida = new Partida(
      configuracaoValida,
      jogadores,
      indiceDoPe,
      gerarAleatorio,
      cartasNaPrimeiraRodada ?? null,
    );
    partida.distribuirRodada();
    return partida;
  }

  /**
   * Repõe uma rodada já jogada para refazer as mesmas ações e perguntar a `visaoPara` o que cada
   * jogador via: o export de treino reconstrói a visão com as regras da própria partida.
   */
  static reencenar(rodada: RodadaParaReencenar): Partida {
    const jogadores = rodada.jogadores.map((jogador) => ({
      ...novoJogador(jogador.jogadorId, jogador.vidasAntes),
      eliminado: jogador.eliminado,
      mao: [...jogador.mao],
    }));
    const indiceDoPe = jogadores.findIndex((jogador) => jogador.id === rodada.idDoPe);
    if (indiceDoPe === -1 || jogadores[indiceDoPe]?.eliminado) {
      throw new ErroDeRegra('ENTRADA_INVALIDA', 'O pé da rodada não está sentado à mesa.');
    }
    const partida = new Partida(rodada.configuracao, jogadores, indiceDoPe, SEM_SORTEIO, null);
    partida.numeroRodada = rodada.numero;
    partida.cartasPorJogador = rodada.cartasPorJogador;
    partida.ultimaVaza = rodada.ultimaVaza;
    partida.resultadoRodada = rodada.resultadoAnterior && [...rodada.resultadoAnterior];
    partida.abrirRodada(rodada.vira);
    return partida;
  }

  get faseAtual(): FasePartida {
    return this.fase;
  }

  get idDaVez(): string | null {
    return this.indiceDaVez === null ? null : this.jogador(this.indiceDaVez).id;
  }

  /**
   * Conta cada ação que faz a partida andar (palpite, carta, nova rodada): identifica a etapa em
   * curso mesmo quando o mesmo jogador fica com a vez duas vezes seguidas.
   */
  get andamento(): number {
    return this.acoes;
  }

  get rodadaCega(): boolean {
    return this.cartasPorJogador === 1;
  }

  /** A última rodada que terminou, com todas as mãos: matéria do diário, nunca de um cliente. */
  get rodadaEncerrada(): FatosDaRodada | null {
    return this.ultimaRodadaEncerrada;
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

  /**
   * Saiu ou foi expulso: o assento some (ou já sumiu) entre as rodadas. É a única fonte do
   * "está saindo" — a sala deriva dela quem ainda pertence à mesa.
   */
  deixaAMesa(jogadorId: string): boolean {
    return (
      this.saidasPendentes.get(jogadorId) === 'remover' || this.assentosRetirados.has(jogadorId)
    );
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
    this.anotarOcorrencia({ tipo: 'saida', jogadorId });
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
    this.acoes += 1;
    this.rodadaEmMontagem?.palpites.push({ lance: this.acoes, jogadorId, quantidade });
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
    this.acoes += 1;
    this.rodadaEmMontagem?.cartasDaVaza.push({ lance: this.acoes, jogadorId, carta });

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
    this.acoes += 1;
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

  /** Única opção que muda com a partida em andamento: não altera regra, só a visão dos eliminados. */
  definirMortosVeemCartas(mortosVeemCartas: boolean): void {
    this.configuracao = { ...this.configuracao, mortosVeemCartas };
    this.anotarOcorrencia({ tipo: 'mortosVeemCartas', valor: mortosVeemCartas });
  }

  /** Quem observa só recebe o que pode ver: as regras de visibilidade ficam em `projetarPara`. */
  visaoPara(jogadorId: string | null, momento: MomentoDaVisao = 'aoVivo'): VisaoDaPartida {
    // `indiceDe` recusa quem não está na partida antes de qualquer coisa ser montada.
    const observadorId = jogadorId === null ? null : this.jogador(this.indiceDe(jogadorId)).id;
    return projetarPara(this.retrato(), observadorId, momento);
  }

  private retrato(): RetratoDaPartida {
    const rodadaEmJogo = this.fase === 'palpites' || this.fase === 'jogando';
    return {
      configuracao: this.configuracao,
      fase: this.fase,
      numeroRodada: this.numeroRodada,
      cartasPorJogador: this.cartasPorJogador,
      rodadaCega: this.rodadaCega,
      vira: this.vira,
      manilha: this.manilha,
      valores: this.valores,
      jogadores: this.jogadores.map((jogador) => ({
        ...jogador,
        saiAoFimDaRodada: this.saidasPendentes.has(jogador.id),
      })),
      idDoPe: this.fase === 'encerrada' ? null : this.jogador(this.indiceDoPe).id,
      idDoPrimeiro: rodadaEmJogo ? this.jogador(this.proximoVivo(this.indiceDoPe)).id : null,
      idDaVez: this.idDaVez,
      mesa: this.mesa,
      ultimaVaza: this.ultimaVaza,
      vazasEmpatadas: this.vazasEmpatadas,
      palpiteProibidoDoPe: this.palpiteProibidoAtual(),
      resultadoRodada: this.resultadoRodada,
      vencedores: this.vencedores,
    };
  }

  private distribuirRodada(): void {
    const vivos = this.vivos();
    const maximo = maxCartasPorJogador(totalDeCartas(this.configuracao), vivos.length);
    const anterior = this.numeroRodada === 0 ? null : this.cartasPorJogador;
    const abreComVarias = anterior === null && this.cartasNaPrimeiraRodada !== null;
    this.cartasPorJogador = abreComVarias
      ? Math.min(this.cartasNaPrimeiraRodada ?? 1, maximo)
      : proximaQuantidadeDeCartas(anterior, maximo);
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
    const vira = monte.pop() as Carta;
    this.abrirRodada(vira);
    this.rodadaEmMontagem = {
      fatos: {
        numero: this.numeroRodada,
        cartasPorJogador: this.cartasPorJogador,
        cega: this.rodadaCega,
        vira,
        manilha: this.manilha as Valor,
        idDoPe: this.jogador(this.indiceDoPe).id,
        mortosVeemCartas: this.configuracao.mortosVeemCartas,
        jogadores: this.jogadores.map((jogador) => ({
          jogadorId: jogador.id,
          vidasAntes: jogador.vidas,
          eliminado: jogador.eliminado,
          mao: [...jogador.mao],
        })),
      },
      palpites: [],
      vazas: [],
      ocorrencias: [],
      cartasDaVaza: [],
    };
  }

  /** Cartas já na mão de todos: vira à mesa e a vez com quem está à esquerda do pé. */
  private abrirRodada(vira: Carta): void {
    this.vira = vira;
    this.manilha = valorDaManilha(vira.valor, this.valores);
    this.mesa = [];
    this.vazasEmpatadas = [];
    this.fase = 'palpites';
    this.indiceDaVez = this.proximoVivo(this.indiceDoPe);
  }

  /** Só a rodada em jogo anota: entre rodadas, a próxima já começa com o estado novo. */
  private anotarOcorrencia(ocorrencia: OcorrenciaSemPosicao): void {
    const montagem = this.rodadaEmMontagem;
    if (!montagem) return;
    const cartasJogadas =
      montagem.vazas.reduce((total, vaza) => total + vaza.cartas.length, 0) +
      montagem.cartasDaVaza.length;
    montagem.ocorrencias.push({
      ...ocorrencia,
      depoisDe: montagem.palpites.length + cartasJogadas,
    });
  }

  private fecharVaza(): void {
    const jogadas = this.mesa;
    const vencedorId = resolverVaza(jogadas, this.manilha as Valor, this.valores);
    const organizadas = organizarMesa(jogadas, this.manilha as Valor, this.valores);
    this.ultimaVaza = { jogadas: organizadas, vencedorId };
    this.mesa = [];
    const montagem = this.rodadaEmMontagem;
    if (montagem) {
      montagem.vazas.push({ cartas: montagem.cartasDaVaza, vencedorId });
      montagem.cartasDaVaza = [];
    }
    if (vencedorId === null) {
      // A mais forte por cima: é a que se lê de relance no montinho.
      const [maisForte] = organizadas;
      this.vazasEmpatadas.push({
        cartaDoTopo: (maisForte as JogadaNaMesa).carta,
        quantidadeDeCartas: jogadas.length,
      });
    }

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
    this.fecharRodadaEmMontagem(participantes);
    this.efetivarSaidas(participantes);
  }

  private fecharRodadaEmMontagem(participantes: readonly JogadorNaPartida[]): void {
    const montagem = this.rodadaEmMontagem;
    if (!montagem || !this.resultadoRodada) return;
    const vidasDepois = new Map(participantes.map((jogador) => [jogador.id, jogador.vidas]));
    this.ultimaRodadaEncerrada = {
      ...montagem.fatos,
      palpites: montagem.palpites,
      vazas: montagem.vazas,
      ocorrencias: montagem.ocorrencias,
      resultado: this.resultadoRodada.map((resultado) => ({
        ...resultado,
        vidasDepois: vidasDepois.get(resultado.jogadorId) as number,
      })),
    };
    this.rodadaEmMontagem = null;
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
      this.assentosRetirados.add(id);
    }
  }

  /** Quem entra no meio recebe a vida do jogador vivo com mais vidas e senta no fim da mesa. */
  private sentarEntrantes(): void {
    if (this.entrantes.length === 0) return;
    const vidasDosVivos = this.vivos().map((jogador) => jogador.vidas);
    const maisVidas =
      vidasDosVivos.length > 0 ? Math.max(...vidasDosVivos) : this.configuracao.vidasIniciais;
    for (const id of this.entrantes) this.jogadores.push(novoJogador(id, maisVidas));
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
