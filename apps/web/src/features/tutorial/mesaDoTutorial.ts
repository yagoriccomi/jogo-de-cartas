import type {
  Carta,
  ConfiguracaoPartida,
  EstadoPartidaVisivel,
  EstadoSala,
  FasePartida,
  JogadaNaMesa,
  Naipe,
  ResultadoJogadorNaRodada,
  SessaoJogador,
  Valor,
  VazaGanha,
  VazaResolvida,
} from '@fodinha/shared';

/**
 * A mesa do tutorial: um retrato montado à mão a cada passo do roteiro, no mesmo formato que o
 * servidor envia. Nada aqui calcula regra (força, anulação, vidas): o roteiro descreve o resultado
 * já conhecido da rodada ensaiada, para a lição sair sempre igual.
 */

export const ID_VOCE = 'tutorial-voce';
export const ID_PAULA = 'tutorial-paula';
export const ID_SIMAS = 'tutorial-simas';
const CODIGO_DA_SALA = 'TUTORIAL';

const CONFIGURACAO: ConfiguracaoPartida = {
  quantidadeBaralhos: 1,
  vidasIniciais: 5,
  incluirOitoNoveDez: false,
};

const carta = (id: string, valor: Valor, naipe: Naipe): Carta => ({ id, valor, naipe });

/** Vira 6♦: a manilha da rodada é o 7. */
export const VIRA = carta('t-6o', '6', 'ouros');
export const MANILHA: Valor = '7';

export const CARTAS = {
  seteDePaus: carta('t-7p', '7', 'paus'),
  asDeCopas: carta('t-Ac', 'A', 'copas'),
  quatroDeEspadas: carta('t-4e', '4', 'espadas'),
  reiDeOuros: carta('t-Ko', 'K', 'ouros'),
  doisDeCopas: carta('t-2c', '2', 'copas'),
  cincoDePaus: carta('t-5p', '5', 'paus'),
  tresDeEspadas: carta('t-3e', '3', 'espadas'),
  doisDePaus: carta('t-2p', '2', 'paus'),
  damaDeOuros: carta('t-Qo', 'Q', 'ouros'),
} as const;

export interface JogadorDoTutorial {
  readonly id: string;
  readonly apelido: string;
  readonly ehBot: boolean;
  /** Já em ordem de força (a mais forte primeiro), como o servidor manda. */
  readonly mao: readonly Carta[];
  readonly palpite: number | null;
  readonly vazasGanhas: readonly VazaGanha[];
  readonly vidas: number;
}

export interface Momento {
  readonly fase: FasePartida;
  readonly idDaVez: string | null;
  /** Ordem dos assentos: você (o pé), Paula (a mão) e Simas. */
  readonly jogadores: readonly JogadorDoTutorial[];
  /** Já organizada como o servidor organiza: da mais forte para a mais fraca, com as anuladas. */
  readonly mesa: readonly JogadaNaMesa[];
  readonly ultimaVaza: VazaResolvida | null;
  readonly palpiteProibido: number | null;
  readonly resultadoRodada: readonly ResultadoJogadorNaRodada[] | null;
}

export const NUMERO_DA_RODADA = 3;
export const CARTAS_NA_RODADA = 3;

export function paraEstadoDaPartida(momento: Momento): EstadoPartidaVisivel {
  const eu = momento.jogadores.find((jogador) => jogador.id === ID_VOCE);
  const rodadaEmJogo = momento.fase === 'palpites' || momento.fase === 'jogando';
  return {
    configuracao: CONFIGURACAO,
    fase: momento.fase,
    numeroRodada: NUMERO_DA_RODADA,
    cartasPorJogador: CARTAS_NA_RODADA,
    rodadaCega: false,
    vira: VIRA,
    manilha: MANILHA,
    jogadores: momento.jogadores.map((jogador) => ({
      id: jogador.id,
      apelido: jogador.apelido,
      ehBot: jogador.ehBot,
      conectado: true,
      vidas: jogador.vidas,
      eliminado: false,
      palpite: jogador.palpite,
      vazasFeitas: jogador.vazasGanhas.length,
      vazasGanhas: jogador.vazasGanhas,
      cartasNaMao: jogador.mao.length,
      cartaNaTesta: null,
      saiAoFimDaRodada: false,
    })),
    idDoPe: ID_VOCE,
    idDoPrimeiro: rodadaEmJogo ? ID_PAULA : null,
    idDaVez: momento.idDaVez,
    // Sem prazo: no tutorial ninguém é apressado pelo relógio.
    prazoDaVezEm: null,
    prazoDaVezRestanteMs: null,
    minhaMao: eu?.mao ?? [],
    mesa: momento.mesa,
    ultimaVaza: momento.ultimaVaza,
    vazasEmpatadas: [],
    palpiteProibido: momento.palpiteProibido,
    resultadoRodada: momento.resultadoRodada,
    proximaRodada: null,
    vencedores: [],
    pausa: null,
  };
}

export function salaDoTutorial(apelido: string): EstadoSala {
  const participante = (id: string, nome: string, ehBot: boolean) => ({
    id,
    apelido: nome,
    ehBot,
    conectado: true,
    // Ninguém é dono: o menu não oferece pausar, reiniciar nem expulsar no tutorial.
    ehAnfitriao: false,
    aguardandoProximaRodada: false,
    saindo: false,
  });
  return {
    codigo: CODIGO_DA_SALA,
    configuracao: CONFIGURACAO,
    participantes: [
      participante(ID_VOCE, apelido, false),
      participante(ID_PAULA, 'Paula Tejano', true),
      participante(ID_SIMAS, 'Simas Turbo', true),
    ],
    emPartida: true,
  };
}

export const SESSAO_DO_TUTORIAL: SessaoJogador = {
  codigoSala: CODIGO_DA_SALA,
  jogadorId: ID_VOCE,
  tokenSessao: '',
};
