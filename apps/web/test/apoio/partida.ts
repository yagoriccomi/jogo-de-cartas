import {
  CONFIGURACAO_PADRAO,
  type EstadoPartidaVisivel,
  type JogadorVisivel,
} from '@fodinha/shared';

/** Quem joga neste aparelho nos testes. */
export const EU = 'eu';

export function jogador(id: string, campos: Partial<JogadorVisivel> = {}): JogadorVisivel {
  return {
    id,
    apelido: id === EU ? 'Eu Mesmo' : `${id.toUpperCase()} Silva`,
    ehBot: false,
    conectado: true,
    vidas: 5,
    eliminado: false,
    palpite: null,
    vazasFeitas: 0,
    vazasGanhas: [],
    cartasNaMao: 3,
    cartaNaTesta: null,
    maoRevelada: null,
    saiAoFimDaRodada: false,
    ...campos,
  };
}

/** Mesa de 4 na ordem a (mão), b, eu, d (pé), 3 cartas, ninguém palpitou ainda. */
export function partida(campos: Partial<EstadoPartidaVisivel> = {}): EstadoPartidaVisivel {
  return {
    configuracao: CONFIGURACAO_PADRAO,
    fase: 'palpites',
    numeroRodada: 2,
    cartasPorJogador: 3,
    rodadaCega: false,
    vira: null,
    manilha: '5',
    jogadores: [jogador('a'), jogador('b'), jogador(EU), jogador('d')],
    idDoPe: 'd',
    idDoPrimeiro: 'a',
    idDaVez: 'a',
    prazoDaVezEm: null,
    prazoDaVezRestanteMs: 20_000,
    minhaMao: [],
    mesa: [],
    ultimaVaza: null,
    vazasEmpatadas: [],
    palpiteProibido: null,
    resultadoRodada: null,
    proximaRodada: null,
    vencedores: [],
    pausa: null,
    ...campos,
  };
}
