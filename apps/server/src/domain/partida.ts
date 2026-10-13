import type {
  Carta,
  CartaNaMao,
  ConfiguracaoPartida,
  FasePartida,
  Jogada,
  ResultadoJogadorNaRodada,
  Valor,
  VazaResolvida,
} from '@fodinha/shared';
import { LIMITES } from '@fodinha/shared';
import type { GeradorAleatorio } from './aleatoriedade';
import { montarBaralhoEmbaralhado, totalDeCartas, valoresEmJogo } from './baralho';
import { validarConfiguracao } from './configuracao';
import { ErroDeRegra } from './erros';
import { valorDaManilha } from './forca';
import {
  maxCartasPorJogador,
  palpiteProibidoDoPe,
  proximaQuantidadeDeCartas,
  vidasPerdidas,
} from './rodadas';
import { resolverVaza } from './vaza';

interface JogadorNaPartida {
  readonly id: string;
  vidas: number;
  eliminado: boolean;
  mao: Carta[];
  palpite: number | null;
  vazasFeitas: number;
}

/** Projeção do jogador para quem observa; dados de sala (apelido, bot, conexão) vêm da aplicação. */
export interface JogadorNaVisao {
  readonly id: string;
  readonly vidas: number;
  readonly eliminado: boolean;
  readonly palpite: number | null;
  readonly vazasFeitas: number;
  readonly cartasNaMao: number;
  readonly cartaNaTesta: Carta | null;
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
  readonly idDaVez: string | null;
  readonly minhaMao: readonly CartaNaMao[];
  readonly mesa: readonly Jogada[];
  readonly ultimaVaza: VazaResolvida | null;
  readonly palpiteProibido: number | null;
  readonly resultadoRodada: readonly ResultadoJogadorNaRodada[] | null;
  readonly vencedores: readonly string[];
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
    this.jogadores = jogadorIds.map((id) => ({
      id,
      vidas: configuracao.vidasIniciais,
      eliminado: false,
      mao: [],
      palpite: null,
      vazasFeitas: 0,
    }));
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

  participa(jogadorId: string): boolean {
    return this.jogadores.some((jogador) => jogador.id === jogadorId);
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
    this.indiceDoPe = this.proximoVivo(this.indiceDoPe);
    this.distribuirRodada();
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
    const idDoPe = this.fase === 'encerrada' ? null : this.jogador(this.indiceDoPe).id;

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
        vazasFeitas: jogador.vazasFeitas,
        cartasNaMao: jogador.mao.length,
        cartaNaTesta: this.cartaNaTestaVistaPor(jogador, observador),
      })),
      idDoPe,
      idDaVez: this.idDaVez,
      minhaMao: observador ? this.maoVistaPeloDono(observador) : [],
      mesa: [...this.mesa],
      ultimaVaza: this.ultimaVaza,
      palpiteProibido:
        observador && indiceObservador === this.indiceDoPe && this.fase === 'palpites'
          ? this.palpiteProibidoAtual()
          : null,
      resultadoRodada: this.resultadoRodada,
      vencedores: [...this.vencedores],
    };
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
      jogador.vazasFeitas = 0;
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
    this.ultimaVaza = { jogadas, vencedorId };
    this.mesa = [];

    // Vaza anulada: quem abriu continua abrindo (premissa P4 do plano).
    const indiceQueAbre = vencedorId === null ? this.indiceQueAbriuVaza : this.indiceDe(vencedorId);
    if (vencedorId !== null) this.jogador(indiceQueAbre).vazasFeitas += 1;

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
      const perdidas = vidasPerdidas(palpite, jogador.vazasFeitas);
      jogador.vidas -= perdidas;
      jogador.eliminado = jogador.vidas <= 0;
      return {
        jogadorId: jogador.id,
        palpite,
        vazasFeitas: jogador.vazasFeitas,
        vidasPerdidas: perdidas,
      };
    });
    this.indiceDaVez = null;

    const sobreviventes = this.vivos();
    if (sobreviventes.length > 1) {
      this.fase = 'fim_de_rodada';
      return;
    }
    this.fase = 'encerrada';
    this.vencedores =
      sobreviventes.length === 1
        ? [(sobreviventes[0] as JogadorNaPartida).id]
        : this.maisVidasEntre(participantes).map((jogador) => jogador.id);
  }

  /** Todos zeraram na mesma rodada: vence quem ficou menos negativo (premissa P8). */
  private maisVidasEntre(jogadores: readonly JogadorNaPartida[]): JogadorNaPartida[] {
    const maximo = Math.max(...jogadores.map((jogador) => jogador.vidas));
    return jogadores.filter((jogador) => jogador.vidas === maximo);
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

  private maoVistaPeloDono(dono: JogadorNaPartida): CartaNaMao[] {
    if (!this.rodadaCega) return [...dono.mao];
    return dono.mao.map((carta) => ({ id: carta.id, oculta: true as const }));
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
      const candidato = (indice + passo) % this.jogadores.length;
      if (!this.jogador(candidato).eliminado) return candidato;
    }
    return indice;
  }
}
