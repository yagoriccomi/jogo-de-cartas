import { LIMITES } from '@fodinha/shared';

/**
 * Agenda da mesa: o que acontece a seguir sem ninguém agir e em que instante. Puro: o "agora"
 * chega como argumento, vindo do relógio injetado na aplicação.
 */

const MS_POR_SEGUNDO = 1000;
const LIMITE_DA_LEITURA_DAS_REGRAS_MS = LIMITES.maxLeituraDasRegrasSegundos * MS_POR_SEGUNDO;

export interface TemposDaMesa {
  /** Atraso artificial do bot, para que os humanos acompanhem as jogadas. */
  readonly atrasoDoBotMs: number;
  /** Tempo de exibição do resultado da rodada antes da próxima distribuição. */
  readonly pausaFimDeRodadaMs: number;
  /**
   * Acréscimo à pausa quando a rodada que acabou era cega: as cartas vão sozinhas à mesa de uma
   * vez e o jogador precisa de mais tempo para descobrir a própria carta e entender o resultado.
   */
  readonly pausaExtraRodadaCegaMs: number;
}

/**
 * A etapa da partida que o relógio pode fazer andar. `andamento` distingue duas etapas iguais em
 * sequência (quem ganha a vaza volta a ter a vez) para o prazo não continuar do anterior.
 */
export type Etapa =
  | {
      readonly tipo: 'vez';
      readonly andamento: number;
      readonly jogadorId: string;
      /** Bot de verdade ou humano com saída marcada: anda pelo atraso do bot, não pelo prazo. */
      readonly conduzidoPorBot: boolean;
    }
  | { readonly tipo: 'fimDeRodada'; readonly andamento: number; readonly rodadaCega: boolean };

/** Desde quando a etapa em curso corre e quanto dela já ficou congelado por pausas. */
export interface MarcoDaEtapa {
  readonly chave: string;
  readonly desde: number;
  /** Soma das pausas já encerradas durante esta etapa. */
  readonly pausadaPorMs: number;
  /** Instante em que a pausa em curso começou; `null` = a etapa está correndo. */
  readonly pausadaDesde: number | null;
}

export interface Registro {
  readonly etapa: Etapa | null;
  readonly pausada: boolean;
  readonly agora: number;
}

export interface SituacaoDaMesa {
  readonly etapa: Etapa | null;
  readonly marco: MarcoDaEtapa | null;
  readonly leitura: { readonly jogadorId: string; readonly desde: number } | null;
  readonly pausada: boolean;
  /** `null` = sala sem limite de tempo: ninguém joga pelo humano que demora. */
  readonly prazoDaVezMs: number | null;
}

export type ProximoPasso =
  | { readonly tipo: 'fimDaLeitura'; readonly jogadorId: string; readonly em: number }
  | { readonly tipo: 'jogadaDoBot'; readonly jogadorId: string; readonly em: number }
  | { readonly tipo: 'prazoDaVez'; readonly jogadorId: string; readonly em: number }
  | { readonly tipo: 'proximaRodada'; readonly em: number };

function chaveDa(etapa: Etapa): string {
  const quem = etapa.tipo === 'vez' ? `${etapa.jogadorId}:${etapa.conduzidoPorBot}` : '';
  return `${etapa.andamento}:${etapa.tipo}:${quem}`;
}

/**
 * Atualiza o marco a cada mudança na sala. Etapa nova começa a contar agora; a mesma etapa mantém
 * o início, para entrar, cair, votar ou mudar opção não devolverem o prazo inteiro. A pausa guarda
 * quando começou e, ao terminar, soma a duração: assim a etapa continua do que restava.
 */
export function registrarMarco(
  anterior: MarcoDaEtapa | null,
  { etapa, pausada, agora }: Registro,
): MarcoDaEtapa | null {
  if (!etapa) return null;
  const chave = chaveDa(etapa);
  if (anterior?.chave !== chave) {
    return { chave, desde: agora, pausadaPorMs: 0, pausadaDesde: pausada ? agora : null };
  }
  if (pausada && anterior.pausadaDesde === null) return { ...anterior, pausadaDesde: agora };
  if (!pausada && anterior.pausadaDesde !== null) {
    return {
      ...anterior,
      pausadaPorMs: anterior.pausadaPorMs + (agora - anterior.pausadaDesde),
      pausadaDesde: null,
    };
  }
  return anterior;
}

function duracaoDa(etapa: Etapa, prazoDaVezMs: number | null, tempos: TemposDaMesa): number | null {
  if (etapa.tipo === 'fimDeRodada') {
    return tempos.pausaFimDeRodadaMs + (etapa.rodadaCega ? tempos.pausaExtraRodadaCegaMs : 0);
  }
  return etapa.conduzidoPorBot ? tempos.atrasoDoBotMs : prazoDaVezMs;
}

/** O próximo passo automático e o instante absoluto em que ele acontece; `null` = nada a fazer. */
export function proximoPasso(situacao: SituacaoDaMesa, tempos: TemposDaMesa): ProximoPasso | null {
  const { etapa, marco, leitura } = situacao;
  // A leitura das regras é a única pausa com fim marcado: o relógio dela anda mesmo pausado.
  if (leitura) {
    return {
      tipo: 'fimDaLeitura',
      jogadorId: leitura.jogadorId,
      em: leitura.desde + LIMITE_DA_LEITURA_DAS_REGRAS_MS,
    };
  }
  // Pausa congela a mesa inteira: nada anda até a votação se resolver ou o dono retomar.
  if (situacao.pausada || !etapa) return null;
  // Marco de outra etapa = a mudança ainda não foi registrada; agendar agora daria o instante errado.
  if (!marco || marco.chave !== chaveDa(etapa)) return null;

  const duracao = duracaoDa(etapa, situacao.prazoDaVezMs, tempos);
  if (duracao === null) return null;
  const em = marco.desde + marco.pausadaPorMs + duracao;
  if (etapa.tipo === 'fimDeRodada') return { tipo: 'proximaRodada', em };
  return {
    tipo: etapa.conduzidoPorBot ? 'jogadaDoBot' : 'prazoDaVez',
    jogadorId: etapa.jogadorId,
    em,
  };
}

/** Mesmo tipo, mesmo jogador e mesmo instante: reagendar não muda nada. */
export function mesmoPasso(a: ProximoPasso | null, b: ProximoPasso | null): boolean {
  if (a === null || b === null) return a === b;
  const jogadorDe = (passo: ProximoPasso) => ('jogadorId' in passo ? passo.jogadorId : null);
  return a.tipo === b.tipo && a.em === b.em && jogadorDe(a) === jogadorDe(b);
}
