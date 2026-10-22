import { ehCartaOculta, type CartaNaMao } from '@fodinha/shared';
import { TEMPOS_DA_ANIMACAO } from './animacao-compartilhada';

/**
 * Decisões da mão sem DOM nem relógio: quando refazer a distribuição, o que cada carta faz no
 * voo e o que a mão diz ao jogador. `Mao.tsx` e `mao-animacoes.ts` só executam o plano.
 */

/** Retrato da mão num render, para comparar com o próximo. */
export interface RegistroDaMao {
  /** Muda quando muda a rodada, uma carta entra/sai ou uma carta oculta vira comum. */
  readonly assinatura: string;
  readonly ids: ReadonlySet<string>;
  readonly rodada: number | undefined;
}

export function registrarMao(
  cartas: readonly CartaNaMao[],
  rodada: number | undefined,
): RegistroDaMao {
  const chaves = cartas.map((carta) => carta.id + (ehCartaOculta(carta) ? '!' : ''));
  return {
    assinatura: `${rodada ?? ''}:${chaves.join('|')}`,
    ids: new Set(cartas.map((carta) => carta.id)),
    rodada,
  };
}

/**
 * - `nenhuma`: nada mudou;
 * - `mesmaMao`: a mão mudou sem ser outra (carta jogada, mão esvaziada);
 * - `maoNova`: rodada nova ou carta inédita, que pede a distribuição.
 */
export type MudancaDaMao = 'nenhuma' | 'mesmaMao' | 'maoNova';

export function mudancaDaMao(anterior: RegistroDaMao, atual: RegistroDaMao): MudancaDaMao {
  if (atual.assinatura === anterior.assinatura) return 'nenhuma';
  if (atual.ids.size === 0) return 'mesmaMao';
  // Sem o número da rodada (quem chama não informou), só os ids revelam uma mão nova.
  const rodadaMudou = atual.rodada !== undefined && atual.rodada !== anterior.rodada;
  const cartaInedita = [...atual.ids].some((id) => !anterior.ids.has(id));
  return rodadaMudou || cartaInedita ? 'maoNova' : 'mesmaMao';
}

export interface InicioDaMao {
  readonly animarAoMontar: boolean;
  readonly quantidade: number;
  readonly menosMovimento: boolean;
}

/** Ao montar, só distribui quando pedido (abertura da partida): reconectar mostra a mão pronta. */
export function comecaDistribuindo(inicio: InicioDaMao): boolean {
  return inicio.animarAoMontar && inicio.quantidade > 0 && !inicio.menosMovimento;
}

/** Plano do voo de uma carta, na ordem recebida do servidor. */
export interface VooDaCarta {
  /** Posição do leque onde ela pousa antes de a mão se organizar (sorteada, fora de ordem). */
  readonly lugar: number;
  /** Espera desde o início da animação: o embaralhar e as cartas dos outros vêm antes. */
  readonly atrasoMs: number;
  /** Carta oculta (rodada cega) já é verso: voa sem desvirar. */
  readonly desvira: boolean;
}

export interface EntradaDaDistribuicao {
  /** Uma entrada por carta, na ordem do servidor: `true` se a carta é oculta. */
  readonly ocultas: readonly boolean[];
  readonly jogadoresNaMesa: number;
  /** Número em [0, 1), injetado para o sorteio dos lugares ser determinístico nos testes. */
  readonly sortear: () => number;
}

/** Embaralha os lugares (Fisher-Yates): a carta recebida em i-ésimo pousa em `lugares[i]`. */
function sortearLugares(quantidade: number, sortear: () => number): number[] {
  const lugares = Array.from({ length: quantidade }, (_, indice) => indice);
  for (let i = lugares.length - 1; i > 0; i -= 1) {
    const j = Math.floor(sortear() * (i + 1));
    const guardado = lugares[i] ?? 0;
    lugares[i] = lugares[j] ?? 0;
    lugares[j] = guardado;
  }
  return lugares;
}

/**
 * Minhas cartas chegam uma a cada volta da mesa (uma carta por jogador), depois do embaralhar,
 * no mesmo ritmo do baralho (`TEMPOS_DA_ANIMACAO`).
 */
export function planejarDistribuicao(entrada: EntradaDaDistribuicao): VooDaCarta[] {
  const { ocultas, jogadoresNaMesa, sortear } = entrada;
  const { embaralharMs, intervaloDaDistribuicaoMs } = TEMPOS_DA_ANIMACAO;
  const lugares = sortearLugares(ocultas.length, sortear);
  return ocultas.map((oculta, indice) => ({
    lugar: lugares[indice] ?? indice,
    atrasoMs: embaralharMs + indice * intervaloDaDistribuicaoMs * jogadoresNaMesa,
    desvira: !oculta,
  }));
}

export interface EntradaDaVistaDaMao {
  readonly cartas: readonly CartaNaMao[];
  /** A distribuição ainda está em curso. */
  readonly chegando: boolean;
  readonly podeJogar: boolean;
  /** Aparelho de toque: muda o texto da dica do gesto. */
  readonly toque: boolean;
  /** Primeiro uso do seletor no aparelho: a dica ganha o destaque "Dica". */
  readonly destacarDica: boolean;
}

export interface VistaDaMao {
  readonly todasOcultas: boolean;
  /** Cartas respondem a toque/clique: minha vez, distribuição terminada e mão visível. */
  readonly interativa: boolean;
  readonly dica: string;
  readonly ensinandoGesto: boolean;
  /** Uma entrada por carta: desenhar o verso por cima da face (ainda não "desvirou"). */
  readonly versos: readonly boolean[];
  /** "Mais forte / Mais fraca": com 1 carta não há ordem. */
  readonly mostrarOrdem: boolean;
}

export function vistaDaMao(entrada: EntradaDaVistaDaMao): VistaDaMao {
  const { cartas, chegando, podeJogar, toque, destacarDica } = entrada;
  const todasOcultas = cartas.every(ehCartaOculta);
  const interativa = podeJogar && !chegando && !todasOcultas;
  return {
    todasOcultas,
    interativa,
    dica: dicaDaMao({ quantidade: cartas.length, todasOcultas, interativa, toque }),
    ensinandoGesto: interativa && destacarDica,
    versos: cartas.map((carta) => chegando && !ehCartaOculta(carta)),
    mostrarOrdem: cartas.length > 1,
  };
}

interface EntradaDaDica {
  readonly quantidade: number;
  readonly todasOcultas: boolean;
  readonly interativa: boolean;
  readonly toque: boolean;
}

function dicaDaMao({ quantidade, todasOcultas, interativa, toque }: EntradaDaDica): string {
  if (todasOcultas) return 'Rodada cega · sua carta fica virada e é revelada na mesa';
  if (!interativa) return `Sua mão · ${quantidade} ${quantidade === 1 ? 'carta' : 'cartas'}`;
  return toque
    ? 'Toque para escolher, toque duas vezes para jogar'
    : 'Clique para escolher, dois cliques rápidos para jogar · botão direito cancela';
}

/** Ids das cartas ocultas: a rodada cega precisa medir de onde cada uma sai quando some da mão. */
export function idsDasOcultas(cartas: readonly CartaNaMao[]): string[] {
  return cartas.filter(ehCartaOculta).map((carta) => carta.id);
}
