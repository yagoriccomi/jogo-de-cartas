import type {
  Carta,
  CartaNaMao,
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
  // Rodada cega.
  seteDeCopas: carta('t-7c', '7', 'copas'),
  tresDeOuros: carta('t-3o', '3', 'ouros'),
  cincoDeEspadas: carta('t-5e', '5', 'espadas'),
} as const;

/** Na rodada cega o servidor manda a sua carta assim: só o id, sem valor nem naipe. */
export const CARTA_VIRADA: CartaNaMao = { id: CARTAS.seteDeCopas.id, oculta: true };

/** O que muda de uma rodada para outra no roteiro: tamanho, vira, manilha, mão e pé. */
export interface RodadaDoTutorial {
  readonly numero: number;
  readonly cartas: number;
  readonly vira: Carta;
  readonly manilha: Valor;
  readonly idDoPrimeiro: string;
  readonly idDoPe: string;
}

/** Rodada de 3 cartas. Vira 6♦: a manilha é o 7. Paula é a mão; você, o pé. */
export const RODADA_DE_TRES: RodadaDoTutorial = {
  numero: 3,
  cartas: 3,
  vira: carta('t-6o', '6', 'ouros'),
  manilha: '7',
  idDoPrimeiro: ID_PAULA,
  idDoPe: ID_VOCE,
};

/** Rodada cega (1 carta). Vira Q♥: a manilha é o J. Simas é a mão; Paula, o pé. */
export const RODADA_CEGA: RodadaDoTutorial = {
  numero: 4,
  cartas: 1,
  vira: carta('t-Qc', 'Q', 'copas'),
  manilha: 'J',
  idDoPrimeiro: ID_SIMAS,
  idDoPe: ID_PAULA,
};

export interface JogadorDoTutorial {
  readonly id: string;
  readonly apelido: string;
  readonly ehBot: boolean;
  /** Já em ordem de força (a mais forte primeiro), como o servidor manda. */
  readonly mao: readonly CartaNaMao[];
  /** Rodada cega: a carta que os outros veem na testa deste jogador. */
  readonly testa: Carta | null;
  readonly palpite: number | null;
  readonly vazasGanhas: readonly VazaGanha[];
  readonly vidas: number;
}

export interface Momento {
  readonly rodada: RodadaDoTutorial;
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

export function paraEstadoDaPartida(momento: Momento): EstadoPartidaVisivel {
  const { rodada } = momento;
  const eu = momento.jogadores.find((jogador) => jogador.id === ID_VOCE);
  const rodadaEmJogo = momento.fase === 'palpites' || momento.fase === 'jogando';
  return {
    configuracao: CONFIGURACAO,
    fase: momento.fase,
    numeroRodada: rodada.numero,
    cartasPorJogador: rodada.cartas,
    rodadaCega: rodada.cartas === 1,
    vira: rodada.vira,
    manilha: rodada.manilha,
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
      // A sua própria testa você nunca vê.
      cartaNaTesta: jogador.id === ID_VOCE ? null : jogador.testa,
      saiAoFimDaRodada: false,
    })),
    idDoPe: rodada.idDoPe,
    idDoPrimeiro: rodadaEmJogo ? rodada.idDoPrimeiro : null,
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
