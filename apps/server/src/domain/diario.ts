import type { Carta, ConfiguracaoPartida, Valor } from '@fodinha/shared';
import type { PerfilDeBot } from './bot/perfis';
import type {
  FatosDaRodada,
  JogadorDaRodada,
  OcorrenciaDaRodada,
  Partida,
  ResultadoDaRodada,
} from './partida';

/**
 * Diário da partida: o registro do que aconteceu, rodada a rodada, para o histórico e para treinar
 * bots. Guarda só fatos (mãos, ordem das jogadas, quem decidiu); a visão de cada decisão é refeita
 * por `reconstruirRodada` com as regras da partida, em vez de gravar a mesa inteira a cada lance.
 * Quem decidiu fica gravado, senão os dados de treino se misturam com as jogadas dos próprios bots.
 * Jogadores só por id opaco: o apelido não entra.
 */

/**
 * Sobe quando o formato do JSON da rodada muda. A v1 gravava a visão inteira em cada decisão e
 * nunca chegou a produção: o export a ignora.
 */
export const VERSAO_DO_DIARIO = 2;

/**
 * Quem decidiu. `prazo`: o humano estourou o tempo e o servidor jogou por ele. `saida`: o humano
 * saiu, foi expulso ou eliminado por votação, e um bot termina a rodada por ele.
 */
export type AutorDaDecisao =
  | { readonly tipo: 'humano' }
  | { readonly tipo: 'bot'; readonly perfil: PerfilDeBot }
  | { readonly tipo: 'prazo'; readonly perfil: PerfilDeBot }
  | { readonly tipo: 'saida'; readonly perfil: PerfilDeBot };

export const DECISAO_HUMANA: AutorDaDecisao = { tipo: 'humano' };

export interface ParticipanteDoDiario {
  readonly jogadorId: string;
  readonly tipo: 'humano' | 'bot';
  readonly perfil: PerfilDeBot | null;
}

export interface PalpiteDoDiario {
  readonly jogadorId: string;
  readonly quantidade: number;
  /** `null` só se a ação não passou pela Sala (não acontece em sala real). */
  readonly autor: AutorDaDecisao | null;
}

export interface JogadaDoDiario {
  readonly jogadorId: string;
  readonly carta: Carta;
  /** `null` na rodada cega: as cartas vão sozinhas à mesa, ninguém decide nada. */
  readonly autor: AutorDaDecisao | null;
}

export interface VazaDoDiario {
  /** Na ordem em que foram jogadas. */
  readonly jogadas: readonly JogadaDoDiario[];
  /** `null` = todas se anularam. */
  readonly vencedorId: string | null;
}

/** Uma linha do histórico: o JSON gravado por rodada. */
export interface RodadaDoDiario {
  readonly versao: number;
  readonly numero: number;
  readonly cartasPorJogador: number;
  readonly cega: boolean;
  readonly vira: Carta;
  readonly manilha: Valor;
  readonly idDoPe: string;
  /** A opção no começo da rodada (o dono pode trocá-la no meio: vai para `ocorrencias`). */
  readonly mortosVeemCartas: boolean;
  /** Todos os assentos na ordem da mesa, eliminados inclusive, com a mão recebida na distribuição. */
  readonly jogadores: readonly JogadorDaRodada[];
  readonly palpites: readonly PalpiteDoDiario[];
  readonly vazas: readonly VazaDoDiario[];
  readonly ocorrencias: readonly OcorrenciaDaRodada[];
  readonly resultado: readonly ResultadoDaRodada[];
}

export interface RodadaConcluida {
  readonly rodada: RodadaDoDiario;
  /** Quem jogou a primeira rodada agora (entrou no meio da partida). */
  readonly participantesNovos: readonly ParticipanteDoDiario[];
}

/**
 * `fim`: a partida terminou pelas regras. `interrompida`: o dono reiniciou antes do fim.
 * `abandonada`: a sala sumiu (todos saíram ou ninguém voltou) com a partida em andamento.
 */
export type MotivoDoFim = 'fim' | 'interrompida' | 'abandonada';

export interface ColocacaoNoDiario {
  readonly jogadorId: string;
  /** 1 = vencedor; empates dividem a posição. `null` quando a partida não chegou ao fim. */
  readonly colocacao: number | null;
  readonly vidasFinais: number | null;
}

export interface DesfechoDoDiario {
  readonly motivo: MotivoDoFim;
  readonly rodadasJogadas: number;
  readonly vencedores: readonly string[];
  readonly colocacoes: readonly ColocacaoNoDiario[];
}

/** Até onde cada jogador chegou: base da colocação final. */
interface Percurso {
  readonly ultimaRodada: number;
  readonly vidas: number;
}

/**
 * Acompanha uma partida: a Sala anota cada decisão no lance em que ela aconteceu e, ao fim de cada
 * rodada, o diário junta essas anotações aos fatos que a Partida registrou (mãos, ordem das cartas,
 * vazas). Puro: o instante de cada gravação fica com a aplicação.
 */
export class DiarioDaPartida {
  readonly configuracao: ConfiguracaoPartida;
  readonly participantesIniciais: readonly ParticipanteDoDiario[];
  private readonly conhecidos = new Set<string>();
  private readonly autores = new Map<number, AutorDaDecisao>();
  private readonly concluidas: RodadaConcluida[] = [];
  private readonly percursos = new Map<string, Percurso>();
  private ultimaRodadaVista = 0;

  constructor(
    private readonly partida: Partida,
    private readonly descrever: (jogadorId: string) => ParticipanteDoDiario,
  ) {
    const visao = partida.visaoPara(null);
    this.configuracao = visao.configuracao;
    this.participantesIniciais = visao.jogadores.map((jogador) => this.conhecer(jogador.id));
  }

  /** `lance` é o `andamento` da partida que a ação produziu. */
  anotar(lance: number, autor: AutorDaDecisao): void {
    this.autores.set(lance, autor);
  }

  /** Chamado depois de cada ação: guarda a rodada que acabou de terminar, uma vez só. */
  acompanhar(): void {
    const fatos = this.partida.rodadaEncerrada;
    if (!fatos || fatos.numero <= this.ultimaRodadaVista) return;
    this.ultimaRodadaVista = fatos.numero;
    const participantesNovos = fatos.jogadores
      .filter((jogador) => !this.conhecidos.has(jogador.jogadorId))
      .map((jogador) => this.conhecer(jogador.jogadorId));
    for (const resultado of fatos.resultado) {
      this.percursos.set(resultado.jogadorId, {
        ultimaRodada: fatos.numero,
        vidas: resultado.vidasDepois,
      });
    }
    this.concluidas.push({ rodada: this.montarRodada(fatos), participantesNovos });
    this.autores.clear();
  }

  /** Entrega as rodadas concluídas desde a última retirada (cada uma sai uma vez só). */
  retirarRodadasConcluidas(): RodadaConcluida[] {
    return this.concluidas.splice(0, this.concluidas.length);
  }

  /** `null` enquanto a partida não termina pelas regras. */
  get desfecho(): DesfechoDoDiario | null {
    if (this.partida.faseAtual !== 'encerrada') return null;
    const vencedores = this.partida.visaoPara(null).vencedores;
    return {
      motivo: 'fim',
      rodadasJogadas: this.ultimaRodadaVista,
      vencedores,
      colocacoes: this.colocacoes(new Set(vencedores)),
    };
  }

  /** A partida parou antes do fim: ninguém tem colocação. */
  desfechoSemFim(motivo: Exclude<MotivoDoFim, 'fim'>): DesfechoDoDiario {
    return {
      motivo,
      rodadasJogadas: this.ultimaRodadaVista,
      vencedores: [],
      colocacoes: [...this.conhecidos].map((jogadorId) => ({
        jogadorId,
        colocacao: null,
        vidasFinais: this.percursos.get(jogadorId)?.vidas ?? null,
      })),
    };
  }

  private conhecer(jogadorId: string): ParticipanteDoDiario {
    this.conhecidos.add(jogadorId);
    return this.descrever(jogadorId);
  }

  private montarRodada(fatos: FatosDaRodada): RodadaDoDiario {
    return {
      versao: VERSAO_DO_DIARIO,
      numero: fatos.numero,
      cartasPorJogador: fatos.cartasPorJogador,
      cega: fatos.cega,
      vira: fatos.vira,
      manilha: fatos.manilha,
      idDoPe: fatos.idDoPe,
      mortosVeemCartas: fatos.mortosVeemCartas,
      jogadores: fatos.jogadores,
      palpites: fatos.palpites.map(({ lance, jogadorId, quantidade }) => ({
        jogadorId,
        quantidade,
        autor: this.autorDo(lance),
      })),
      vazas: fatos.vazas.map((vaza) => ({
        vencedorId: vaza.vencedorId,
        jogadas: vaza.cartas.map(({ lance, jogadorId, carta }) => ({
          jogadorId,
          carta,
          autor: fatos.cega ? null : this.autorDo(lance),
        })),
      })),
      ocorrencias: fatos.ocorrencias,
      resultado: fatos.resultado,
    };
  }

  /**
   * Toda ação de sala real passa pela Sala, que anota quem decidiu. Sem anotação grava-se `null`
   * em vez de falhar: o diário nunca pode derrubar a jogada que já aconteceu.
   */
  private autorDo(lance: number): AutorDaDecisao | null {
    return this.autores.get(lance) ?? null;
  }

  /** Vencedores primeiro; depois quem ficou mais rodadas na mesa e, no empate, com mais vidas. */
  private colocacoes(vencedores: ReadonlySet<string>): ColocacaoNoDiario[] {
    const chave = (jogadorId: string) => {
      const percurso = this.percursos.get(jogadorId);
      return [
        vencedores.has(jogadorId) ? 1 : 0,
        percurso?.ultimaRodada ?? 0,
        percurso?.vidas ?? Number.NEGATIVE_INFINITY,
      ] as const;
    };
    const melhor = (a: string, b: string) => {
      const [va, ra, ia] = chave(a);
      const [vb, rb, ib] = chave(b);
      return va > vb || (va === vb && (ra > rb || (ra === rb && ia > ib)));
    };
    const todos = [...this.conhecidos];
    return todos.map((jogadorId) => ({
      jogadorId,
      colocacao: 1 + todos.filter((outro) => melhor(outro, jogadorId)).length,
      vidasFinais: this.percursos.get(jogadorId)?.vidas ?? null,
    }));
  }
}
