import type { Reacao } from '@fodinha/shared';
import { obterContexto } from './contextoDeAudio';
import type { EventoDaMesa } from './eventos';
import { obterVolumeEfeitos, obterVolumeReacoes, volumeParaGanho } from './preferencia';

/** Volume geral: chiptune em onda quadrada é estridente, então fica bem abaixo do máximo. */
const VOLUME_MESTRE = 0.16;
const VOLUME_DO_RUIDO = 0.6;
const ATAQUE_S = 0.005;
const SILENCIO = 0.0001;
/** Pausa entre a carta batendo na mesa e o aviso de quem levou a vaza, para os dois serem ouvidos. */
const ATRASO_DO_RESULTADO_S = 0.12;
const TAMANHO_DO_RUIDO_S = 0.3;

type Onda = 'square' | 'triangle' | 'sawtooth';

interface Tom {
  readonly freq: number;
  readonly duracao: number;
  readonly onda?: Onda;
  readonly volume?: number;
  /** Frequência ao fim do tom: o glissando típico de efeitos de fliperama. */
  readonly ate?: number;
  readonly inicio?: number;
}

/** Notas em Hz (afinação igual temperada). */
const NOTA = {
  sol3: 196,
  do4: 262,
  mi4: 330,
  sol4: 392,
  la4: 440,
  si4: 494,
  do5: 523,
  re5: 587,
  mi5: 659,
  la5: 880,
  sol5: 784,
  si5: 988,
  do6: 1047,
  mi6: 1319,
} as const;

let buferDeRuido: AudioBuffer | null = null;
let saidaDosEfeitos: GainNode | null = null;
let saidaDasReacoes: GainNode | null = null;

function criarSaida(ctx: AudioContext): GainNode {
  const ganho = ctx.createGain();
  ganho.connect(ctx.destination);
  return ganho;
}

/** Todos os efeitos passam por um ganho único, ajustado pelo volume de efeitos do menu. */
function obterSaida(ctx: AudioContext): GainNode {
  saidaDosEfeitos ??= criarSaida(ctx);
  saidaDosEfeitos.gain.setValueAtTime(volumeParaGanho(obterVolumeEfeitos()), ctx.currentTime);
  return saidaDosEfeitos;
}

/** Canal próprio das reações: o jogador abaixa a farra da mesa sem perder os avisos do jogo. */
function obterSaidaDasReacoes(ctx: AudioContext): GainNode {
  saidaDasReacoes ??= criarSaida(ctx);
  saidaDasReacoes.gain.setValueAtTime(volumeParaGanho(obterVolumeReacoes()), ctx.currentTime);
  return saidaDasReacoes;
}

function tocarTom(ctx: AudioContext, base: number, tom: Tom, saida = obterSaida(ctx)): void {
  const inicio = base + (tom.inicio ?? 0);
  const fim = inicio + tom.duracao;
  const oscilador = ctx.createOscillator();
  const ganho = ctx.createGain();
  oscilador.type = tom.onda ?? 'square';
  oscilador.frequency.setValueAtTime(tom.freq, inicio);
  if (tom.ate !== undefined) oscilador.frequency.exponentialRampToValueAtTime(tom.ate, fim);
  ganho.gain.setValueAtTime(SILENCIO, inicio);
  ganho.gain.linearRampToValueAtTime((tom.volume ?? 1) * VOLUME_MESTRE, inicio + ATAQUE_S);
  ganho.gain.exponentialRampToValueAtTime(SILENCIO, fim);
  oscilador.connect(ganho).connect(saida);
  oscilador.start(inicio);
  oscilador.stop(fim + ATAQUE_S);
}

function tocarRuido(ctx: AudioContext, base: number, inicio: number, duracao: number): void {
  if (buferDeRuido === null) {
    buferDeRuido = ctx.createBuffer(1, ctx.sampleRate * TAMANHO_DO_RUIDO_S, ctx.sampleRate);
    const amostras = buferDeRuido.getChannelData(0);
    for (let i = 0; i < amostras.length; i++) amostras[i] = Math.random() * 2 - 1;
  }
  const fonte = ctx.createBufferSource();
  const ganho = ctx.createGain();
  const comeco = base + inicio;
  fonte.buffer = buferDeRuido;
  ganho.gain.setValueAtTime(SILENCIO, comeco);
  ganho.gain.linearRampToValueAtTime(VOLUME_MESTRE * VOLUME_DO_RUIDO, comeco + ATAQUE_S);
  ganho.gain.exponentialRampToValueAtTime(SILENCIO, comeco + duracao);
  fonte.connect(ganho).connect(obterSaida(ctx));
  fonte.start(comeco, 0, duracao);
}

/** Notas curtas uma depois da outra, a intervalos iguais. */
function arpejo(ctx: AudioContext, base: number, passo: number, duracao: number, freqs: number[]) {
  freqs.forEach((freq, i) => tocarTom(ctx, base, { freq, duracao, inicio: i * passo }));
}

const EFEITOS: Record<EventoDaMesa, (ctx: AudioContext, base: number) => void> = {
  cartaJogada: (ctx, t) => tocarTom(ctx, t, { freq: NOTA.la4, ate: NOTA.mi5, duracao: 0.07 }),
  // Campainha "plim-plom" em onda triangular, longa e repetida: os jogadores confundiam o aviso da
  // vez (antes um arpejo quadrado) com o de vaza ganha.
  minhaVez: (ctx, t) => {
    const campainha: readonly (readonly [number, number])[] = [
      [NOTA.sol5, 0],
      [NOTA.mi5, 0.18],
      [NOTA.sol5, 0.5],
      [NOTA.mi5, 0.68],
    ];
    campainha.forEach(([freq, inicio]) =>
      tocarTom(ctx, t, { freq, inicio, duracao: 0.34, onda: 'triangle', volume: 1.6 }),
    );
    tocarTom(ctx, t, { freq: NOTA.mi6, duracao: 0.05, volume: 0.35 });
  },
  vazaMinha: (ctx, t) => arpejo(ctx, t, 0.07, 0.1, [NOTA.do5, NOTA.mi5, NOTA.sol5, NOTA.do6]),
  vazaDeOutro: (ctx, t) =>
    tocarTom(ctx, t, { freq: NOTA.sol3, duracao: 0.1, onda: 'triangle', volume: 0.8 }),
  vazaAnulada: (ctx, t) => {
    tocarTom(ctx, t, { freq: NOTA.do4, ate: NOTA.sol3 / 2, duracao: 0.22, onda: 'sawtooth' });
    tocarRuido(ctx, t, 0, 0.08);
  },
  perdiVida: (ctx, t) => {
    [NOTA.sol4, NOTA.mi4, NOTA.do4].forEach((freq, i) =>
      tocarTom(ctx, t, { freq, ate: freq * 0.85, duracao: 0.17, inicio: i * 0.17 }),
    );
  },
  palpiteConfirmado: (ctx, t) => {
    tocarTom(ctx, t, { freq: NOTA.si5, duracao: 0.06 });
    tocarTom(ctx, t, { freq: NOTA.mi6, duracao: 0.28, inicio: 0.06 });
  },
  novaRodada: (ctx, t) => {
    for (let i = 0; i < 5; i++) tocarRuido(ctx, t, i * 0.07, 0.05);
  },
  vitoria: (ctx, t) => {
    const melodia: readonly (readonly [number, number])[] = [
      [NOTA.do5, 0.1],
      [NOTA.do5, 0.1],
      [NOTA.do5, 0.1],
      [NOTA.sol5, 0.16],
      [NOTA.mi5, 0.1],
      [NOTA.sol5, 0.12],
      [NOTA.do6, 0.4],
    ];
    let inicio = 0;
    for (const [freq, duracao] of melodia) {
      tocarTom(ctx, t, { freq, duracao, inicio });
      inicio += duracao + 0.02;
    }
  },
  derrota: (ctx, t) => {
    [NOTA.sol4, NOTA.mi4, NOTA.re5 / 2, NOTA.do4].forEach((freq, i) =>
      tocarTom(ctx, t, { freq, duracao: 0.2, inicio: i * 0.2, onda: 'triangle' }),
    );
  },
};

/** Eventos que só fazem sentido logo depois da carta cair na mesa. */
const EVENTOS_DE_RESULTADO: ReadonlySet<EventoDaMesa> = new Set([
  'vazaMinha',
  'vazaDeOutro',
  'vazaAnulada',
]);

export function tocarEvento(evento: EventoDaMesa): void {
  const ctx = obterContexto();
  if (ctx === null || ctx.state !== 'running' || obterVolumeEfeitos() === 0) return;
  const atraso = EVENTOS_DE_RESULTADO.has(evento) ? ATRASO_DO_RESULTADO_S : 0;
  EFEITOS[evento](ctx, ctx.currentTime + atraso);
}

/** Um som curto e reconhecível por reação, no mesmo timbre de fliperama dos efeitos. */
const SONS_DAS_REACOES: Record<Reacao, readonly Tom[]> = {
  // Risada: "ha-ha-ha" descendo.
  '😂': [NOTA.mi5, NOTA.do5, NOTA.la4].map((freq, i) => ({
    freq,
    duracao: 0.09,
    inicio: i * 0.12,
  })),
  // Fogo: subida rápida.
  '🔥': [{ freq: NOTA.do5, ate: NOTA.do6 * 2, duracao: 0.3, onda: 'sawtooth', volume: 0.6 }],
  // Susto: buzina descendo.
  '😱': [{ freq: NOTA.la5, ate: NOTA.la4 / 2, duracao: 0.45, onda: 'sawtooth', volume: 0.7 }],
  // Palmas: arpejo curto subindo.
  '👏': [NOTA.do5, NOTA.mi5, NOTA.sol5].map((freq, i) => ({
    freq,
    duracao: 0.07,
    inicio: i * 0.06,
  })),
  // Palhaço: "fom-fom" de buzininha.
  '🤡': [0, 0.2].map((inicio) => ({
    freq: NOTA.sol3,
    duracao: 0.14,
    inicio,
    onda: 'sawtooth' as const,
  })),
  // Sorte: brilho agudo com eco.
  '🍀': [1, 0.5, 0.25].map((volume, i) => ({
    freq: NOTA.mi6,
    duracao: 0.12,
    inicio: i * 0.13,
    onda: 'triangle' as const,
    volume,
  })),
  // Choro: glissando triste.
  '😭': [{ freq: NOTA.mi5, ate: NOTA.sol4, duracao: 0.6, onda: 'triangle', volume: 1.4 }],
  // Reza: dois bips.
  '🙏': [0, 0.16].map((inicio) => ({ freq: NOTA.si5, duracao: 0.08, inicio })),
};

export function tocarReacao(reacao: Reacao): void {
  const ctx = obterContexto();
  if (ctx === null || ctx.state !== 'running' || obterVolumeReacoes() === 0) return;
  const saida = obterSaidaDasReacoes(ctx);
  for (const tom of SONS_DAS_REACOES[reacao]) tocarTom(ctx, ctx.currentTime, tom, saida);
}
