import type { EstadoPartidaVisivel } from './estado';

/**
 * Histórico e replay das partidas de quem está logado com Google. As rotas pedem o cabeçalho
 * `Authorization: Bearer <token do login>`; sem login, ou com o histórico desligado no servidor,
 * respondem com um `ErroDoHistorico` e o web esconde a tela.
 */
export const ROTAS_DO_HISTORICO = {
  /** `GET ?cursor=<proximoCursor>&limite=<n>`: as partidas terminadas, da mais recente para trás. */
  partidas: '/historico/partidas',
  /** `GET`: os lances de uma rodada, vistos do assento de quem pede. */
  rodadaDoReplay: '/historico/partidas/:idPartida/rodadas/:numero',
} as const;

/** Endereço de uma rodada do replay (o `:idPartida` vai escapado). */
export function caminhoDaRodadaDoReplay(idPartida: string, numero: number): string {
  return ROTAS_DO_HISTORICO.rodadaDoReplay
    .replace(':idPartida', encodeURIComponent(idPartida))
    .replace(':numero', String(numero));
}

/** Parâmetros da listagem (`?cursor=&limite=`). */
export const PARAMETROS_DO_HISTORICO = { cursor: 'cursor', limite: 'limite' } as const;

/** Uma partida terminada em que a conta jogou. */
export interface PartidaNoHistorico {
  readonly id: string;
  /** Instantes em epoch ms (UTC). */
  readonly iniciadaEm: number;
  readonly encerradaEm: number;
  /** Todos os assentos que passaram pela partida, bots inclusive. */
  readonly jogadores: number;
  readonly rodadas: number;
  /** 1 = venceu (empates dividem a posição); `null` se a colocação não foi gravada. */
  readonly colocacao: number | null;
  readonly venceu: boolean;
}

export interface PaginaDoHistorico {
  readonly partidas: readonly PartidaNoHistorico[];
  /** Vai no `?cursor=` da próxima página; `null` = não há mais partidas. */
  readonly proximoCursor: string | null;
}

/**
 * Uma rodada do replay: um retrato da mesa por lance, do começo da rodada ao resultado, no mesmo
 * formato que a mesa recebe ao vivo. A partida já terminou, então a mão de todos vem revelada.
 */
export interface RodadaDoReplay {
  readonly idPartida: string;
  readonly numeroRodada: number;
  readonly totalDeRodadas: number;
  /** O assento de quem pede: a mesa do replay é vista dele. */
  readonly jogadorId: string;
  /** Nunca vazio: o primeiro é a mesa recém-distribuída; o último, o fim da rodada (ou da partida). */
  readonly lances: readonly EstadoPartidaVisivel[];
}

/**
 * `sem_login`: falta o token ou ele não vale mais. `desligado`: o servidor não tem banco.
 * `nao_encontrada`: a partida não existe ou a conta não jogou nela (as duas respostas são iguais
 * de propósito, para não revelar partidas alheias). `inacabada`: a partida não terminou pelas
 * regras e não tem replay. `invalido`: parâmetro fora do formato. `ilegivel`: o diário gravado não
 * fecha com as regras (versão antiga ou corrompido). `indisponivel`: o banco falhou agora.
 */
export type MotivoDoErroDoHistorico =
  | 'sem_login'
  | 'desligado'
  | 'nao_encontrada'
  | 'inacabada'
  | 'invalido'
  | 'ilegivel'
  | 'indisponivel';

export interface ErroDoHistorico {
  readonly motivo: MotivoDoErroDoHistorico;
  readonly erro: string;
}
