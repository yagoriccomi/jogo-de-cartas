import { embaralhar, type GeradorAleatorio } from '../aleatoriedade';

/**
 * Estilos de jogo dos bots. Todos leem a mesa do mesmo jeito; o perfil muda o quanto arriscam,
 * sabotam e erram. Sorteados no começo de cada partida, conforme quantos bots vão jogar (`sortearPerfis`).
 */
export const PERFIS_DE_BOT = [
  'equilibrado',
  'cauteloso',
  'ousado',
  'sabotador',
  'estrategista',
  'caotico',
] as const;

export type PerfilDeBot = (typeof PERFIS_DE_BOT)[number];

export const NOMES_DOS_PERFIS: Readonly<Record<PerfilDeBot, string>> = {
  equilibrado: 'Equilibrado',
  cauteloso: 'Cauteloso',
  ousado: 'Ousado',
  sabotador: 'Sabotador',
  estrategista: 'Estrategista',
  caotico: 'Caótico',
};

/** Quem joga por um humano que estourou o prazo: o estilo neutro, sem vantagem nem castigo. */
export const PERFIL_DA_JOGADA_AUTOMATICA: PerfilDeBot = 'equilibrado';

/** Os números que dão o estilo de cada bot. A leitura da mesa e a escada são as mesmas para todos. */
export interface AjustesDoPerfil {
  /** Chance de cada decisão ir para a segunda melhor. */
  readonly chanceDeErro: number;
  /**
   * Vazas somadas ao palpite por carta na mão (negativo = pede menos). Por carta, e não fixo, para
   * a ousadia caber tanto na rodada de 13 cartas da mesa de 3 quanto na de 3 cartas da mesa de 10.
   */
  readonly viesPorCarta: number;
  /** Quanto desconta do palpite por vaza que a mesa já pediu acima da média. */
  readonly pesoDosPalpitesDaMesa: number;
  /** Abaixo disso, ganhar agora com a carta não compensa: alguém depois a supera ou anula. */
  readonly chanceMinimaDeSegurar: number;
  /** Deixa quem joga logo depois fazer a vaza dele para fechar a próxima. */
  readonly esperaAPosicao: boolean;
  /** Com sobra de cartas, abre a vaza com a mais forte em vez da do meio. */
  readonly abreComAMaisForte: boolean;
  /**
   * `nunca`: só pensa em si. `semRisco`: atrapalha os outros só com cartas que não ganham a vaza.
   * `arriscando`: atrapalha mesmo com carta que alguém depois pode cobrir, devolvendo a vaza a ele.
   */
  readonly sabotagem: 'nunca' | 'semRisco' | 'arriscando';
}

const EQUILIBRADO: AjustesDoPerfil = {
  chanceDeErro: 0.1,
  viesPorCarta: 0,
  pesoDosPalpitesDaMesa: 0.35,
  chanceMinimaDeSegurar: 0.6,
  esperaAPosicao: true,
  abreComAMaisForte: false,
  sabotagem: 'semRisco',
};

export const AJUSTES_DOS_PERFIS: Readonly<Record<PerfilDeBot, AjustesDoPerfil>> = {
  equilibrado: EQUILIBRADO,
  // Pede menos e só tenta a vaza com carta difícil de cobrir; não gasta jogada atrapalhando.
  cauteloso: {
    ...EQUILIBRADO,
    chanceDeErro: 0.08,
    viesPorCarta: -0.03,
    chanceMinimaDeSegurar: 0.8,
    sabotagem: 'nunca',
  },
  // Pede mais, gasta as fortes cedo e não espera posição.
  ousado: {
    ...EQUILIBRADO,
    viesPorCarta: 0.04,
    pesoDosPalpitesDaMesa: 0.2,
    chanceMinimaDeSegurar: 0.4,
    esperaAPosicao: false,
    abreComAMaisForte: true,
  },
  // Atrapalha a mesa até correndo risco.
  sabotador: { ...EQUILIBRADO, sabotagem: 'arriscando' },
  // Lê mais os palpites da mesa e quase não erra.
  estrategista: { ...EQUILIBRADO, chanceDeErro: 0.04, pesoDosPalpitesDaMesa: 0.45 },
  // Erra muito e decide no impulso: a mesa fica imprevisível.
  caotico: {
    ...EQUILIBRADO,
    chanceDeErro: 0.2,
    pesoDosPalpitesDaMesa: 0.15,
    chanceMinimaDeSegurar: 0.5,
    esperaAPosicao: false,
  },
};

// ---------------------------------------------------------------------------------------------
// Quem joga com qual perfil: sorteado no começo de cada partida
// ---------------------------------------------------------------------------------------------

export const GRUPOS_DE_PERFIS = {
  cautelosos: ['cauteloso', 'estrategista'],
  equilibrados: ['equilibrado', 'sabotador'],
  agressivos: ['ousado', 'caotico'],
} as const satisfies Record<string, readonly PerfilDeBot[]>;

type Grupo = keyof typeof GRUPOS_DE_PERFIS;
const GRUPOS = Object.keys(GRUPOS_DE_PERFIS) as Grupo[];

// Com três bots, a chance média de o grupo do primeiro sorteado voltar no lugar do terceiro.
export const CHANCE_DE_REPETIR_O_PRIMEIRO_GRUPO = 1 / 3;
// Com quatro bots ou mais, nenhum grupo passa disto: a mesa não vira só de um estilo.
export const MAXIMO_DO_MESMO_GRUPO = 3;

function sortear<T>(opcoes: readonly T[], gerar: GeradorAleatorio): T {
  return opcoes[Math.floor(gerar() * opcoes.length)] as T;
}

/**
 * Até dois bots, cada um cai num grupo qualquer. A partir de três, há um de cada grupo (com três,
 * o terceiro às vezes repete o grupo do primeiro); os que sobram vão a grupos que ainda cabem.
 */
function sortearGrupos(quantidade: number, gerar: GeradorAleatorio): Grupo[] {
  if (quantidade < GRUPOS.length) {
    return Array.from({ length: quantidade }, () => sortear(GRUPOS, gerar));
  }
  const grupos = embaralhar(GRUPOS, gerar);
  if (quantidade === GRUPOS.length) {
    if (gerar() < CHANCE_DE_REPETIR_O_PRIMEIRO_GRUPO)
      grupos[grupos.length - 1] = grupos[0] as Grupo;
    return grupos;
  }
  while (grupos.length < quantidade) {
    const cabem = GRUPOS.filter(
      (grupo) => grupos.filter((g) => g === grupo).length < MAXIMO_DO_MESMO_GRUPO,
    );
    grupos.push(sortear(cabem.length > 0 ? cabem : GRUPOS, gerar));
  }
  return embaralhar(grupos, gerar);
}

/** Um perfil por bot; dentro do grupo, prefere um perfil que ainda não saiu. */
export function sortearPerfis(quantidade: number, gerar: GeradorAleatorio): PerfilDeBot[] {
  const escolhidos: PerfilDeBot[] = [];
  for (const grupo of sortearGrupos(quantidade, gerar)) {
    const doGrupo: readonly PerfilDeBot[] = GRUPOS_DE_PERFIS[grupo];
    const ineditos = doGrupo.filter((perfil) => !escolhidos.includes(perfil));
    escolhidos.push(sortear(ineditos.length > 0 ? ineditos : doGrupo, gerar));
  }
  return escolhidos;
}
