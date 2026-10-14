import type { Carta, JogadaNaMesa } from '@fodinha/shared';
import {
  CARTAS,
  ID_PAULA,
  ID_SIMAS,
  ID_VOCE,
  type JogadorDoTutorial,
  type Momento,
} from './mesaDoTutorial';

/** O que faz o roteiro andar: o botão do balão, o tempo (vez dos bots) ou a sua jogada certa. */
export type Espera =
  | { readonly tipo: 'botao'; readonly rotulo?: string }
  | { readonly tipo: 'tempo'; readonly ms: number }
  | { readonly tipo: 'palpite'; readonly valor: number }
  | { readonly tipo: 'jogar'; readonly carta: Carta };

export interface Balao {
  /** Seletor CSS do que o balão aponta (vários separados por vírgula: vale o primeiro visível). */
  readonly alvo: string | null;
  readonly titulo?: string;
  readonly texto: string;
}

export interface Passo {
  readonly momento: Momento;
  readonly balao: Balao | null;
  readonly espera: Espera;
}

/** Tempo para ler uma jogada de bot antes de a próxima acontecer. */
const LEITURA_DA_JOGADA_MS = 2600;
const VIDAS_INICIAIS = 5;

const ALVO_DA_MESA = '.mesa-linhas';
const ALVO_DO_MEU_FEZ = '.numeros--minha';
const alvoDaCartaNaMao = (carta: Carta) => `[data-carta-mao="${carta.id}"]`;
const alvoDaPlaca = (id: string, dentro: string) => `[data-placa-jogador="${id}"] ${dentro}`;

const naMesa = (jogadorId: string, carta: Carta, anulada = false): JogadaNaMesa => ({
  jogadorId,
  carta,
  anulada,
});

function comJogador(
  momento: Momento,
  id: string,
  mudar: (jogador: JogadorDoTutorial) => Partial<JogadorDoTutorial>,
): Momento {
  return {
    ...momento,
    jogadores: momento.jogadores.map((j) => (j.id === id ? { ...j, ...mudar(j) } : j)),
  };
}

const palpitou = (momento: Momento, id: string, palpite: number): Momento =>
  comJogador(momento, id, () => ({ palpite }));

/** Tira a carta da mão de quem jogou e põe a mesa já organizada (descrita pelo roteiro). */
function jogou(
  momento: Momento,
  id: string,
  carta: Carta,
  mesa: readonly JogadaNaMesa[],
  idDaVez: string | null,
): Momento {
  const semACarta = comJogador(momento, id, (j) => ({
    mao: j.mao.filter((c) => c.id !== carta.id),
  }));
  return { ...semACarta, mesa, idDaVez };
}

/** Fecha a vaza como o servidor: mesa limpa, vaza resolvida e um montinho para quem ganhou. */
function fechouVaza(momento: Momento, vencedorId: string, cartaVencedora: Carta): Momento {
  const fechada = comJogador(momento, vencedorId, (j) => ({
    vazasGanhas: [...j.vazasGanhas, { cartaVencedora, quantidadeDeCartas: momento.mesa.length }],
  }));
  return {
    ...fechada,
    mesa: [],
    ultimaVaza: { jogadas: momento.mesa, vencedorId },
    idDaVez: vencedorId,
  };
}

function montarRoteiro(apelido: string): Passo[] {
  const passos: Passo[] = [];
  let m: Momento = {
    fase: 'palpites',
    idDaVez: ID_PAULA,
    jogadores: [
      {
        id: ID_VOCE,
        apelido,
        ehBot: false,
        mao: [CARTAS.seteDePaus, CARTAS.asDeCopas, CARTAS.quatroDeEspadas],
        palpite: null,
        vazasGanhas: [],
        vidas: VIDAS_INICIAIS,
      },
      {
        id: ID_PAULA,
        apelido: 'Paula Tejano',
        ehBot: true,
        mao: [CARTAS.doisDeCopas, CARTAS.reiDeOuros, CARTAS.cincoDePaus],
        palpite: null,
        vazasGanhas: [],
        vidas: VIDAS_INICIAIS,
      },
      {
        id: ID_SIMAS,
        apelido: 'Simas Turbo',
        ehBot: true,
        mao: [CARTAS.tresDeEspadas, CARTAS.doisDePaus, CARTAS.damaDeOuros],
        palpite: null,
        vazasGanhas: [],
        vidas: VIDAS_INICIAIS,
      },
    ],
    mesa: [],
    ultimaVaza: null,
    palpiteProibido: null,
    resultadoRodada: null,
  };
  const passo = (balao: Balao | null, espera: Espera = { tipo: 'botao' }) =>
    passos.push({ momento: m, balao, espera });

  // ---------- Apresentação ----------
  passo(
    {
      alvo: null,
      titulo: 'Bem-vindo à mesa!',
      texto:
        'Vou te ensinar Fodinha jogando uma rodada de 3 cartas contra a Paula e o Simas. É só seguir os balões.',
    },
    { tipo: 'botao', rotulo: 'Bora!' },
  );
  passo({
    alvo: '.mao',
    titulo: 'Suas cartas',
    texto:
      'Ficam sempre em ordem: a mais forte à esquerda. Das comuns, a força é 3, 2, A, K, J, Q, 7, 6, 5 e 4.',
  });
  passo({
    alvo: '.feltro__esquerda',
    titulo: 'Vira e manilha',
    texto:
      'Esta é a vira (6♦). O valor logo acima dela vira a manilha, que vence qualquer carta comum. Aqui, a manilha é o 7.',
  });
  passo({
    alvo: alvoDaCartaNaMao(CARTAS.seteDePaus),
    titulo: 'Você tem manilha!',
    texto:
      'Repare no brilho holográfico. Entre manilhas o naipe decide: ♣ > ♥ > ♠ > ♦. Seu 7♣ é a carta mais forte da rodada.',
  });
  passo({
    alvo: '.adversarios',
    titulo: 'Seus adversários',
    texto:
      'Cada placa mostra as vidas (corações), o palpite e quantas vazas a pessoa já fez. O robozinho indica que é bot.',
  });
  passo({
    alvo: alvoDaPlaca(ID_PAULA, '.simbolo--mao'),
    titulo: 'A mão',
    texto: 'A mãozinha marca quem abre a rodada: a Paula palpita e joga primeiro.',
  });
  passo({
    alvo: '.simbolos--minha',
    titulo: 'O pé',
    texto: 'E você é o pé: palpita por último. Isso tem uma regra especial, já já você vê.',
  });

  // ---------- Palpites ----------
  m = { ...palpitou(m, ID_PAULA, 1), idDaVez: ID_SIMAS };
  passo(
    {
      alvo: alvoDaPlaca(ID_PAULA, '.numeros'),
      texto: 'A Paula acha que vai fazer 1 vaza.',
    },
    { tipo: 'tempo', ms: LEITURA_DA_JOGADA_MS },
  );
  m = { ...palpitou(m, ID_SIMAS, 1), idDaVez: ID_VOCE, palpiteProibido: 1 };
  passo(
    {
      alvo: '.palpite',
      titulo: 'Seu palpite',
      texto:
        'O Simas também disse 1. O 1 está riscado para você: o pé não pode fechar a soma em 3, alguém tem que errar. Com manilha e Ás, escolha 2 e confirme.',
    },
    { tipo: 'palpite', valor: 2 },
  );

  // ---------- Vaza 1: manilha vence tudo ----------
  m = { ...palpitou(m, ID_VOCE, 2), fase: 'jogando', idDaVez: ID_PAULA, palpiteProibido: null };
  passo({
    alvo: ALVO_DO_MEU_FEZ,
    titulo: 'Agora é jogar',
    texto: 'Palpite feito! Você precisa fazer exatamente 2 vazas: nem mais, nem menos.',
  });
  m = jogou(m, ID_PAULA, CARTAS.reiDeOuros, [naMesa(ID_PAULA, CARTAS.reiDeOuros)], ID_SIMAS);
  passo(
    { alvo: ALVO_DA_MESA, texto: 'A Paula abriu a vaza com o K♦.' },
    { tipo: 'tempo', ms: LEITURA_DA_JOGADA_MS },
  );
  m = jogou(
    m,
    ID_SIMAS,
    CARTAS.tresDeEspadas,
    [naMesa(ID_SIMAS, CARTAS.tresDeEspadas), naMesa(ID_PAULA, CARTAS.reiDeOuros)],
    ID_VOCE,
  );
  passo({
    alvo: ALVO_DA_MESA,
    titulo: 'Quem está ganhando',
    texto:
      'O Simas jogou 3♠, mais forte. A carta que está ganhando fica sozinha à esquerda; as outras formam uma pilha ao lado.',
  });
  passo(
    {
      alvo: alvoDaCartaNaMao(CARTAS.seteDePaus),
      titulo: 'Sua vez de jogar',
      texto: 'Toque uma vez na carta para escolher e mais uma para jogar. Jogue o 7♣!',
    },
    { tipo: 'jogar', carta: CARTAS.seteDePaus },
  );
  m = jogou(
    m,
    ID_VOCE,
    CARTAS.seteDePaus,
    [
      naMesa(ID_VOCE, CARTAS.seteDePaus),
      naMesa(ID_SIMAS, CARTAS.tresDeEspadas),
      naMesa(ID_PAULA, CARTAS.reiDeOuros),
    ],
    null,
  );
  passo(
    {
      alvo: ALVO_DA_MESA,
      texto: 'Manilha vence qualquer carta comum: o 7♣ assumiu a frente e a vaza é sua!',
    },
    { tipo: 'botao', rotulo: 'Recolher' },
  );
  m = fechouVaza(m, ID_VOCE, CARTAS.seteDePaus);
  passo({
    alvo: ALVO_DO_MEU_FEZ,
    titulo: 'Uma vaza!',
    texto:
      'A vaza vira um montinho para quem ganhou, e o seu "Fez" subiu para 1. Quem ganha abre a próxima.',
  });

  // ---------- Vaza 2: cartas iguais se anulam ----------
  passo(
    {
      alvo: alvoDaCartaNaMao(CARTAS.asDeCopas),
      texto: 'Abra a próxima vaza com o Ás de copas.',
    },
    { tipo: 'jogar', carta: CARTAS.asDeCopas },
  );
  m = jogou(m, ID_VOCE, CARTAS.asDeCopas, [naMesa(ID_VOCE, CARTAS.asDeCopas)], ID_PAULA);
  passo(
    { alvo: ALVO_DA_MESA, texto: 'Você abriu com o Ás. Agora é a vez da Paula.' },
    { tipo: 'tempo', ms: LEITURA_DA_JOGADA_MS },
  );
  m = jogou(
    m,
    ID_PAULA,
    CARTAS.doisDeCopas,
    [naMesa(ID_PAULA, CARTAS.doisDeCopas), naMesa(ID_VOCE, CARTAS.asDeCopas)],
    ID_SIMAS,
  );
  passo({
    alvo: ALVO_DA_MESA,
    texto: 'Opa: a Paula jogou um 2, que é mais forte que o Ás. Agora quem lidera é ela.',
  });
  m = jogou(
    m,
    ID_SIMAS,
    CARTAS.doisDePaus,
    [
      naMesa(ID_PAULA, CARTAS.doisDeCopas, true),
      naMesa(ID_SIMAS, CARTAS.doisDePaus, true),
      naMesa(ID_VOCE, CARTAS.asDeCopas),
    ],
    null,
  );
  passo(
    {
      alvo: ALVO_DA_MESA,
      titulo: 'Iguais se anulam!',
      texto:
        'O Simas também jogou um 2. Cartas iguais se anulam: os dois 2 descem para a linha de baixo e não valem nada. Seu Ás volta a ganhar! (Se todas se anulassem, ninguém levaria a vaza.)',
    },
    { tipo: 'botao', rotulo: 'Recolher' },
  );
  m = fechouVaza(m, ID_VOCE, CARTAS.asDeCopas);
  passo({
    alvo: ALVO_DO_MEU_FEZ,
    titulo: 'Bateu o palpite',
    texto: 'Você fez 2, exatamente o que pediu. O "Fez" fica ciano quando bate com o palpite.',
  });

  // ---------- Vaza 3: não fazer mais nenhuma ----------
  passo(
    {
      alvo: alvoDaCartaNaMao(CARTAS.quatroDeEspadas),
      titulo: 'Cuidado agora',
      texto: 'Se fizer mais uma vaza, você erra o palpite! Jogue o 4♠, a carta mais fraca do jogo.',
    },
    { tipo: 'jogar', carta: CARTAS.quatroDeEspadas },
  );
  m = jogou(
    m,
    ID_VOCE,
    CARTAS.quatroDeEspadas,
    [naMesa(ID_VOCE, CARTAS.quatroDeEspadas)],
    ID_PAULA,
  );
  passo(
    { alvo: ALVO_DA_MESA, texto: 'Boa. Agora os bots respondem.' },
    { tipo: 'tempo', ms: LEITURA_DA_JOGADA_MS },
  );
  m = jogou(
    m,
    ID_PAULA,
    CARTAS.cincoDePaus,
    [naMesa(ID_PAULA, CARTAS.cincoDePaus), naMesa(ID_VOCE, CARTAS.quatroDeEspadas)],
    ID_SIMAS,
  );
  passo(
    { alvo: ALVO_DA_MESA, texto: 'A Paula jogou 5♣.' },
    { tipo: 'tempo', ms: LEITURA_DA_JOGADA_MS },
  );
  m = jogou(
    m,
    ID_SIMAS,
    CARTAS.damaDeOuros,
    [
      naMesa(ID_SIMAS, CARTAS.damaDeOuros),
      naMesa(ID_PAULA, CARTAS.cincoDePaus),
      naMesa(ID_VOCE, CARTAS.quatroDeEspadas),
    ],
    null,
  );
  passo(
    {
      alvo: ALVO_DA_MESA,
      texto: 'O Simas levou com a Q♦. Ufa: você continua com 2, como pediu.',
    },
    { tipo: 'botao', rotulo: 'Recolher' },
  );

  // ---------- Fim da rodada ----------
  m = fechouVaza(m, ID_SIMAS, CARTAS.damaDeOuros);
  m = comJogador({ ...m, fase: 'fim_de_rodada', idDaVez: null }, ID_PAULA, (j) => ({
    vidas: j.vidas - 1,
  }));
  m = {
    ...m,
    resultadoRodada: [
      { jogadorId: ID_VOCE, palpite: 2, vazasFeitas: 2, vidasPerdidas: 0 },
      { jogadorId: ID_PAULA, palpite: 1, vazasFeitas: 0, vidasPerdidas: 1 },
      { jogadorId: ID_SIMAS, palpite: 1, vazasFeitas: 1, vidasPerdidas: 0 },
    ],
  };
  passo({
    alvo: '.resultado',
    titulo: 'Fim da rodada',
    texto:
      'Quem erra o palpite perde 1 vida por vaza de diferença. A Paula pediu 1 e fez 0: perdeu 1 coração. Você e o Simas acertaram.',
  });
  passo({
    alvo: '.alca-topo, .cabecalho__acoes',
    titulo: 'Placar e regras',
    texto:
      'Aqui no topo ficam o placar de todos e o guia de regras, a qualquer momento. No celular, toque na alça para abrir.',
  });
  passo(
    {
      alvo: null,
      titulo: 'Agora é com você!',
      texto:
        'As rodadas vão de 1 carta até o máximo e voltam. Na de 1 carta você não vê a sua, só a dos outros! Quem zera as vidas sai; o último com vida vence.',
    },
    { tipo: 'botao', rotulo: 'Jogar de verdade' },
  );
  return passos;
}

export { montarRoteiro };
