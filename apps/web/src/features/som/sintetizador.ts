import { obterContexto } from './contextoDeAudio';
import type { EventoDaMesa } from './eventos';
import { obterVolumeEfeitos, volumeParaGanho } from './preferencia';

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

/** Todos os efeitos passam por um ganho único, ajustado pelo volume de efeitos do menu. */
function obterSaida(ctx: AudioContext): GainNode {
  if (saidaDosEfeitos === null) {
    saidaDosEfeitos = ctx.createGain();
    saidaDosEfeitos.connect(ctx.destination);
  }
  saidaDosEfeitos.gain.setValueAtTime(volumeParaGanho(obterVolumeEfeitos()), ctx.currentTime);
  return saidaDosEfeitos;
}

function tocarTom(ctx: AudioContext, base: number, tom: Tom): void {
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
  oscilador.connect(ganho).connect(obterSaida(ctx));
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
  minhaVez: (ctx, t) => arpejo(ctx, t, 0.13, 0.12, [NOTA.mi5, NOTA.la5, NOTA.mi6]),
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
