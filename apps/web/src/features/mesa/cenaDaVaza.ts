import type { FasePartida, VazaResolvida } from '@fodinha/shared';
import { DESTINO_DOS_EMPATES, TEMPOS_DA_ANIMACAO } from './animacao-compartilhada';

/**
 * Linha do tempo da vaza fechada, sem React nem DOM: quanto a vaza fica parada na mesa, quando
 * voa ao montinho, qual montinho ainda está "a caminho" e quando o resultado ou o fim da partida
 * podem cobrir a mesa. O hook só agenda as fases e o adaptador de DOM (mesa-voos) executa o voo.
 */
export const TEMPOS_DA_CENA = {
  /** O servidor limpa a mesa no mesmo estado que fecha a vaza: seguramos as cartas para serem vistas. */
  pausaAntesDoVooMs: 800,
  /**
   * A última vaza decide o resultado da rodada e jogadores reclamaram que ela sumia rápido demais.
   * As vazas do meio continuam curtas: com bots jogando a cada ~2 s, uma pausa maior seria
   * atropelada pela próxima carta.
   */
  pausaDaUltimaVazaMs: 3000,
  /** Na rodada cega as cartas chegam desvirando; todos precisam descobrir a própria carta. */
  leituraDaRevelacaoMs: 2500,
  /** Do montinho se juntar na mesa até pousar em quem ganhou. */
  vooAoMonteMs: 950,
} as const;

export type FaseDaCena = 'espera' | 'voo';

export interface Cena {
  readonly vaza: VazaResolvida;
  readonly fase: FaseDaCena;
  /** Rodada cega: as cartas ainda estão chegando à mesa, então a espera é maior. */
  readonly revelacao: boolean;
  /** Fechou a rodada: fica mais tempo na mesa antes de voar. */
  readonly ultima: boolean;
}

/** Identifica a vaza pelas cartas: o mesmo objeto reenviado pelo servidor não conta como nova. */
export function chaveDaVaza(vaza: VazaResolvida | null): string | null {
  if (vaza === null) return null;
  return `${vaza.vencedorId ?? '-'}:${vaza.jogadas.map((jogada) => jogada.carta.id).join(',')}`;
}

/** Vaza vencida vai para o montinho de quem ganhou; vaza toda anulada, para o monte dos empates. */
export function destinoDaVaza(vaza: VazaResolvida): string {
  return vaza.vencedorId ?? DESTINO_DOS_EMPATES;
}

export interface ChegadaDaVaza {
  readonly vaza: VazaResolvida | null;
  readonly mesaVazia: boolean;
  readonly rodadaCega: boolean;
  readonly fimDeRodada: boolean;
  /** `prefers-reduced-motion`: a vaza vai direto ao montinho, sem cena. */
  readonly menosMovimento: boolean;
}

/** Cena que nasce quando chega uma vaza nova; `null` quando não há o que (ou onde) mostrar. */
export function abrirCena(chegada: ChegadaDaVaza): Cena | null {
  const { vaza, mesaVazia, rodadaCega, fimDeRodada, menosMovimento } = chegada;
  // Mesa já ocupada = a próxima vaza começou rápido; não há onde exibir a cena.
  if (vaza === null || !mesaVazia || menosMovimento) return null;
  return { vaza, fase: 'espera', revelacao: rodadaCega, ultima: fimDeRodada };
}

/** Se alguém jogou na vaza seguinte, a cena não cabe mais na mesa. */
export function cenaAtiva(cena: Cena | null, mesaVazia: boolean): Cena | null {
  return cena !== null && mesaVazia ? cena : null;
}

export function levantarVoo(cena: Cena): Cena {
  return { ...cena, fase: 'voo' };
}

type Duracao = Pick<Cena, 'vaza' | 'revelacao' | 'ultima'>;

/** Quanto a vaza fica parada na mesa antes de voar (na rodada cega, inclui a revelação). */
export function esperaAntesDoVooMs({ vaza, revelacao, ultima }: Duracao): number {
  const parada = ultima ? TEMPOS_DA_CENA.pausaDaUltimaVazaMs : TEMPOS_DA_CENA.pausaAntesDoVooMs;
  if (!revelacao) return parada;
  const escalonamento =
    Math.max(vaza.jogadas.length - 1, 0) * TEMPOS_DA_ANIMACAO.escalonamentoDaRevelacaoMs;
  return (
    parada + TEMPOS_DA_ANIMACAO.vooDaCartaMs + escalonamento + TEMPOS_DA_CENA.leituraDaRevelacaoMs
  );
}

/** Da vaza fechada até o montinho pousar: depois disso o resultado pode cobrir a mesa. */
export function duracaoDaCenaMs(cena: Duracao): number {
  return esperaAntesDoVooMs(cena) + TEMPOS_DA_CENA.vooAoMonteMs;
}

export interface VistaDaCena {
  /** Vaza exibida no centro da mesa enquanto a cena dura (`null` fora dela). */
  readonly vaza: VazaResolvida | null;
  readonly voando: boolean;
  /** Dono (ou `DESTINO_DOS_EMPATES`) do montinho que ainda não chegou; `null` sem cena. */
  readonly monteEmVoo: string | null;
  /** O resultado da rodada espera a última vaza chegar ao montinho; senão cobre a animação. */
  readonly resultadoPodeAparecer: boolean;
  /** A última vaza da partida voa para o montinho antes de o vencedor ser celebrado. */
  readonly fimDePartidaPodeAparecer: boolean;
}

export function vistaDaCena(cena: Cena | null, fase: FasePartida | null): VistaDaCena {
  return {
    vaza: cena?.vaza ?? null,
    voando: cena?.fase === 'voo',
    monteEmVoo: cena === null ? null : destinoDaVaza(cena.vaza),
    resultadoPodeAparecer: fase === 'fim_de_rodada' && cena === null,
    fimDePartidaPodeAparecer: fase === 'encerrada' && cena === null,
  };
}

/**
 * Quantos montinhos (ou vazas feitas) mostrar para `dono`: o que ainda voa só conta ao pousar.
 * Único lugar do "menos 1"; nunca negativo, mesmo se o estado chegar sem a vaza contada.
 */
export function contagemVisivel(monteEmVoo: string | null, dono: string, total: number): number {
  if (monteEmVoo !== dono) return total;
  return Math.max(total - 1, 0);
}
