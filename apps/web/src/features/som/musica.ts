import { obterContexto } from './contextoDeAudio';
import {
  assinarPreferencias,
  obterVolumeMusica,
  somEstaLigado,
  volumeParaGanho,
} from './preferencia';

/*
 * Música de fundo lo-fi gerada na hora com Web Audio: acordes de piano elétrico abafados, batida
 * leve com swing e chiado de vinil. Gerar em vez de tocar um arquivo evita licença de terceiros e
 * download pesado; a progressão fica em loop, mas a melodia e os detalhes variam a cada volta.
 */

const BATIDAS_POR_MINUTO = 70;
const BATIDAS_POR_COMPASSO = 4;
const SEGUNDOS_POR_BATIDA = 60 / BATIDAS_POR_MINUTO;
const SEGUNDOS_POR_COMPASSO = SEGUNDOS_POR_BATIDA * BATIDAS_POR_COMPASSO;
/** Fração da batida em que cai a colcheia do contratempo: acima de 0,5 dá o balanço "arrastado". */
const SWING = 0.6;

/** Teto da música no volume 100. Abafada e sem harmônicos agudos, ela soa mais baixa que os efeitos
 * de onda quadrada mesmo com pico maior; no volume inicial (50%) fica claramente por baixo deles. */
const GANHO_MAXIMO_DA_MUSICA = 0.6;
/** Entrada lenta para a música não assustar quem acabou de tocar na tela. */
const ENTRADA_SUAVE_S = 3;
const SAIDA_SUAVE_S = 0.8;
const CONSTANTE_DO_AJUSTE_DE_VOLUME_S = 0.08;
/** Corta o brilho do conjunto inteiro: é o que dá a cara de fita velha e não cansa o ouvido. */
const CORTE_DO_ABAFADOR_HZ = 2200;

/** O agendador acorda com frequência e agenda o próximo compasso com antecedência. */
const INTERVALO_DO_AGENDADOR_MS = 100;
const ANTECEDENCIA_S = 0.5;
/** Folga entre a decisão de tocar e a primeira nota, para o agendamento não chegar atrasado. */
const ATRASO_INICIAL_S = 0.1;
/** Trocar de tela (lobby → mesa) desmonta e remonta o topo; a música não deve tropeçar nisso. */
const CARENCIA_AO_TROCAR_DE_TELA_MS = 600;

const SILENCIO = 0.0001;
const NOTA_LA4_MIDI = 69;
const FREQUENCIA_LA4_HZ = 440;
const NOTAS_POR_OITAVA = 12;

/** Os primeiros compassos de cada entrada vêm só com piano, e a cada ciclo a batida respira. */
const COMPASSOS_SEM_BATIDA_NA_ENTRADA = 2;
const COMPASSOS_POR_CICLO = 16;
const COMPASSOS_DE_RESPIRO_NO_CICLO = 2;

// Volumes relativos de cada instrumento dentro da música.
const GANHO_PIANO = 0.11;
const GANHO_REPIQUE_PIANO = 0.6;
const GANHO_BRILHO_PIANO = 0.25;
const GANHO_BAIXO = 0.32;
const GANHO_MELODIA = 0.07;
const GANHO_BUMBO = 0.55;
const GANHO_CAIXA = 0.12;
const GANHO_CHIMBAL = 0.035;
const GANHO_VINIL = 0.09;

/** Oscilação lenta de afinação, como uma fita que gira com velocidade irregular. */
const FREQUENCIA_DA_OSCILACAO_HZ = 0.35;
const PROFUNDIDADE_DA_OSCILACAO_CENTS = 7;

const ATAQUE_PIANO_S = 0.02;
const DEFASAGEM_DO_DEDILHADO_S = 0.025;
const DECAIMENTO_PIANO_S = 1.6;
const DECAIMENTO_BRILHO_S = 0.35;
/** Quantas constantes de tempo de um `setTargetAtTime` até o som ficar inaudível. */
const CONSTANTES_ATE_SILENCIAR = 5;
const NIVEL_SUSTENTADO_PIANO = 0.35;
/** O repique do acorde cai no "e" do 3º tempo: o empurrão típico do lo-fi. */
const POSICAO_DO_REPIQUE_BATIDAS = 2.5;
const CHANCE_DO_REPIQUE = 0.7;

const CHANCE_DE_NOTA_DA_MELODIA = 0.22;
const COLCHEIAS_POR_COMPASSO = BATIDAS_POR_COMPASSO * 2;
const DURACAO_NOTA_MELODIA_S = 0.9;

const DURACAO_BUMBO_S = 0.4;
const FREQUENCIA_INICIAL_BUMBO_HZ = 110;
const FREQUENCIA_FINAL_BUMBO_HZ = 42;
const QUEDA_BUMBO_S = 0.12;
const CHANCE_DE_BUMBO_EXTRA = 0.35;
const DURACAO_CAIXA_S = 0.2;
const FREQUENCIA_CAIXA_HZ = 1600;
const DURACAO_CHIMBAL_S = 0.05;
const CORTE_CHIMBAL_HZ = 7000;
/** O chimbal não bate sempre igual: a mão humana varia a força. */
const VARIACAO_DO_CHIMBAL = 0.5;

const TAMANHO_DO_VINIL_S = 3;
const CHANCE_DE_ESTALO_POR_AMOSTRA = 0.0004;
const NIVEL_DO_CHIADO = 0.015;
const CORTE_DO_VINIL_HZ = 3500;

interface Acorde {
  /** Nota do baixo (MIDI). */
  readonly baixo: number;
  /** Vozes do piano (MIDI), da mais grave à mais aguda. */
  readonly vozes: readonly number[];
}

/** ii–V–I–vi em dó com sétimas e nonas: o encadeamento mais "café da tarde" que existe. */
const PROGRESSAO: readonly Acorde[] = [
  { baixo: 38, vozes: [53, 57, 60, 64] }, // Rém9
  { baixo: 43, vozes: [53, 59, 62, 64] }, // Sol13
  { baixo: 36, vozes: [52, 55, 59, 62] }, // Dó7M(9)
  { baixo: 45, vozes: [55, 60, 64, 71] }, // Lám9
];

/** Pentatônica de dó na 5ª oitava: qualquer nota soa bem sobre qualquer acorde da progressão. */
const ESCALA_DA_MELODIA: readonly number[] = [72, 74, 76, 79, 81, 84];

function frequenciaDa(notaMidi: number): number {
  return FREQUENCIA_LA4_HZ * 2 ** ((notaMidi - NOTA_LA4_MIDI) / NOTAS_POR_OITAVA);
}

function sortear<T>(itens: readonly T[]): T | undefined {
  return itens[Math.floor(Math.random() * itens.length)];
}

/** Tempo (s, a partir do início do compasso) de uma colcheia, já com o swing aplicado. */
function tempoDaColcheia(indice: number): number {
  const batida = Math.floor(indice / 2);
  const noContratempo = indice % 2 === 1;
  return (batida + (noContratempo ? SWING : 0)) * SEGUNDOS_POR_BATIDA;
}

interface Grafo {
  readonly ctx: AudioContext;
  /** Volume do jogador; o único nó ligado ao alto-falante. */
  readonly saida: GainNode;
  /** Tudo que é tocado passa por aqui antes da saída. */
  readonly abafador: BiquadFilterNode;
  readonly oscilacao: GainNode;
  readonly fontes: AudioScheduledSourceNode[];
  readonly ruido: AudioBuffer;
}

function criarRuido(ctx: AudioContext): AudioBuffer {
  const bufer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const amostras = bufer.getChannelData(0);
  for (let i = 0; i < amostras.length; i++) amostras[i] = Math.random() * 2 - 1;
  return bufer;
}

/** Chiado quase inaudível com estalos esparsos: o "disco riscado" que dá o clima. */
function criarVinil(ctx: AudioContext): AudioBuffer {
  const bufer = ctx.createBuffer(1, ctx.sampleRate * TAMANHO_DO_VINIL_S, ctx.sampleRate);
  const amostras = bufer.getChannelData(0);
  for (let i = 0; i < amostras.length; i++) {
    const estalo = Math.random() < CHANCE_DE_ESTALO_POR_AMOSTRA ? Math.random() * 2 - 1 : 0;
    amostras[i] = estalo + (Math.random() * 2 - 1) * NIVEL_DO_CHIADO;
  }
  return bufer;
}

function montarGrafo(ctx: AudioContext): Grafo {
  const saida = ctx.createGain();
  saida.gain.setValueAtTime(SILENCIO, ctx.currentTime);
  saida.connect(ctx.destination);

  const abafador = ctx.createBiquadFilter();
  abafador.type = 'lowpass';
  abafador.frequency.value = CORTE_DO_ABAFADOR_HZ;
  abafador.connect(saida);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = FREQUENCIA_DA_OSCILACAO_HZ;
  const oscilacao = ctx.createGain();
  oscilacao.gain.value = PROFUNDIDADE_DA_OSCILACAO_CENTS;
  lfo.connect(oscilacao);
  lfo.start();

  const vinil = ctx.createBufferSource();
  vinil.buffer = criarVinil(ctx);
  vinil.loop = true;
  const filtroVinil = ctx.createBiquadFilter();
  filtroVinil.type = 'lowpass';
  filtroVinil.frequency.value = CORTE_DO_VINIL_HZ;
  const ganhoVinil = ctx.createGain();
  ganhoVinil.gain.value = GANHO_VINIL;
  vinil.connect(filtroVinil).connect(ganhoVinil).connect(saida);
  vinil.start();

  return { ctx, saida, abafador, oscilacao, fontes: [lfo, vinil], ruido: criarRuido(ctx) };
}

interface Nota {
  readonly freq: number;
  readonly inicio: number;
  readonly fim: number;
  readonly ganho: number;
}

/** Piano elétrico: fundamental redonda + um "tine" uma oitava acima que some rápido. */
function tocarPiano(grafo: Grafo, nota: Nota): void {
  const { ctx } = grafo;
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(SILENCIO, nota.inicio);
  envelope.gain.linearRampToValueAtTime(nota.ganho, nota.inicio + ATAQUE_PIANO_S);
  envelope.gain.setTargetAtTime(
    nota.ganho * NIVEL_SUSTENTADO_PIANO,
    nota.inicio + ATAQUE_PIANO_S,
    DECAIMENTO_PIANO_S / 3,
  );
  envelope.gain.setTargetAtTime(SILENCIO, nota.fim, DECAIMENTO_BRILHO_S);
  envelope.connect(grafo.abafador);

  const fundamental = ctx.createOscillator();
  fundamental.type = 'sine';
  fundamental.frequency.value = nota.freq;
  grafo.oscilacao.connect(fundamental.detune);
  fundamental.connect(envelope);

  const brilho = ctx.createOscillator();
  brilho.type = 'triangle';
  brilho.frequency.value = nota.freq * 2;
  grafo.oscilacao.connect(brilho.detune);
  const ganhoBrilho = ctx.createGain();
  ganhoBrilho.gain.setValueAtTime(GANHO_BRILHO_PIANO, nota.inicio);
  ganhoBrilho.gain.setTargetAtTime(0, nota.inicio, DECAIMENTO_BRILHO_S / 3);
  brilho.connect(ganhoBrilho).connect(envelope);

  // Só para depois do fade ter chegado a quase zero; parar antes causa estalo.
  const parada = nota.fim + DECAIMENTO_BRILHO_S * CONSTANTES_ATE_SILENCIAR;
  for (const oscilador of [fundamental, brilho]) {
    // A ligação vinda da oscilação de fita prenderia cada nota tocada na memória para sempre.
    oscilador.onended = () => grafo.oscilacao.disconnect(oscilador.detune);
    oscilador.start(nota.inicio);
    oscilador.stop(parada);
  }
}

function tocarAcorde(grafo: Grafo, acorde: Acorde, toque: Omit<Nota, 'freq'>): void {
  acorde.vozes.forEach((voz, i) => {
    // Dedilhado: as vozes entram uma depois da outra, como dedos de verdade no teclado.
    const inicio = toque.inicio + i * DEFASAGEM_DO_DEDILHADO_S;
    tocarPiano(grafo, { ...toque, freq: frequenciaDa(voz), inicio });
  });
}

function tocarBaixo(grafo: Grafo, notaMidi: number, inicio: number, fim: number): void {
  const { ctx } = grafo;
  const oscilador = ctx.createOscillator();
  oscilador.type = 'sine';
  oscilador.frequency.value = frequenciaDa(notaMidi);
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(SILENCIO, inicio);
  envelope.gain.linearRampToValueAtTime(GANHO_BAIXO, inicio + ATAQUE_PIANO_S * 2);
  envelope.gain.setTargetAtTime(SILENCIO, fim - DECAIMENTO_BRILHO_S, DECAIMENTO_BRILHO_S / 3);
  oscilador.connect(envelope).connect(grafo.abafador);
  oscilador.start(inicio);
  oscilador.stop(fim + DECAIMENTO_BRILHO_S);
}

function tocarBumbo(grafo: Grafo, inicio: number, ganho: number): void {
  const { ctx } = grafo;
  const oscilador = ctx.createOscillator();
  oscilador.frequency.setValueAtTime(FREQUENCIA_INICIAL_BUMBO_HZ, inicio);
  oscilador.frequency.exponentialRampToValueAtTime(
    FREQUENCIA_FINAL_BUMBO_HZ,
    inicio + QUEDA_BUMBO_S,
  );
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(ganho, inicio);
  envelope.gain.exponentialRampToValueAtTime(SILENCIO, inicio + DURACAO_BUMBO_S);
  oscilador.connect(envelope).connect(grafo.abafador);
  oscilador.start(inicio);
  oscilador.stop(inicio + DURACAO_BUMBO_S);
}

interface Ruido {
  readonly filtro: BiquadFilterType;
  readonly frequencia: number;
  readonly duracao: number;
  readonly ganho: number;
}

function tocarRuido(grafo: Grafo, inicio: number, ruido: Ruido): void {
  const { ctx } = grafo;
  const fonte = ctx.createBufferSource();
  fonte.buffer = grafo.ruido;
  const filtro = ctx.createBiquadFilter();
  filtro.type = ruido.filtro;
  filtro.frequency.value = ruido.frequencia;
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(ruido.ganho, inicio);
  envelope.gain.exponentialRampToValueAtTime(SILENCIO, inicio + ruido.duracao);
  fonte.connect(filtro).connect(envelope).connect(grafo.abafador);
  // Começa num ponto aleatório do ruído para duas batidas seguidas não soarem idênticas.
  const deslocamento = Math.random() * (grafo.ruido.duration - ruido.duracao);
  fonte.start(inicio, deslocamento, ruido.duracao);
}

function tocarBatida(grafo: Grafo, inicio: number): void {
  for (let colcheia = 0; colcheia < COLCHEIAS_POR_COMPASSO; colcheia++) {
    const tempo = inicio + tempoDaColcheia(colcheia);
    const variacao = 1 - Math.random() * VARIACAO_DO_CHIMBAL;
    tocarRuido(grafo, tempo, {
      filtro: 'highpass',
      frequencia: CORTE_CHIMBAL_HZ,
      duracao: DURACAO_CHIMBAL_S,
      ganho: GANHO_CHIMBAL * variacao,
    });
  }
  // Bumbo no 1 e no 3; às vezes um a mais no "e" do 2, que tira a batida do quadrado.
  tocarBumbo(grafo, inicio, GANHO_BUMBO);
  tocarBumbo(grafo, inicio + 2 * SEGUNDOS_POR_BATIDA, GANHO_BUMBO);
  if (Math.random() < CHANCE_DE_BUMBO_EXTRA) {
    tocarBumbo(grafo, inicio + tempoDaColcheia(3), GANHO_BUMBO * GANHO_REPIQUE_PIANO);
  }
  for (const batida of [1, 3]) {
    tocarRuido(grafo, inicio + batida * SEGUNDOS_POR_BATIDA, {
      filtro: 'bandpass',
      frequencia: FREQUENCIA_CAIXA_HZ,
      duracao: DURACAO_CAIXA_S,
      ganho: GANHO_CAIXA,
    });
  }
}

function tocarMelodia(grafo: Grafo, inicio: number): void {
  for (let colcheia = 0; colcheia < COLCHEIAS_POR_COMPASSO; colcheia++) {
    if (Math.random() >= CHANCE_DE_NOTA_DA_MELODIA) continue;
    const nota = sortear(ESCALA_DA_MELODIA);
    if (nota === undefined) continue;
    const comeco = inicio + tempoDaColcheia(colcheia);
    tocarPiano(grafo, {
      freq: frequenciaDa(nota),
      inicio: comeco,
      fim: comeco + DURACAO_NOTA_MELODIA_S,
      ganho: GANHO_MELODIA,
    });
  }
}

function temBatida(compasso: number): boolean {
  if (compasso < COMPASSOS_SEM_BATIDA_NA_ENTRADA) return false;
  return compasso % COMPASSOS_POR_CICLO < COMPASSOS_POR_CICLO - COMPASSOS_DE_RESPIRO_NO_CICLO;
}

function tocarCompasso(grafo: Grafo, compasso: number, inicio: number): void {
  const acorde = PROGRESSAO[compasso % PROGRESSAO.length];
  if (acorde === undefined) return;
  const fim = inicio + SEGUNDOS_POR_COMPASSO;
  tocarAcorde(grafo, acorde, { inicio, fim, ganho: GANHO_PIANO });
  if (Math.random() < CHANCE_DO_REPIQUE) {
    const repique = inicio + POSICAO_DO_REPIQUE_BATIDAS * SEGUNDOS_POR_BATIDA;
    tocarAcorde(grafo, acorde, { inicio: repique, fim, ganho: GANHO_PIANO * GANHO_REPIQUE_PIANO });
  }
  tocarBaixo(grafo, acorde.baixo, inicio, fim);
  tocarMelodia(grafo, inicio);
  if (temBatida(compasso)) tocarBatida(grafo, inicio);
}

// ---------- Controle: decide quando a música toca ----------

interface Execucao {
  readonly grafo: Grafo;
  readonly agendador: ReturnType<typeof setInterval>;
}

let execucao: Execucao | null = null;
let pedidos = 0;
let carencia: ReturnType<typeof setTimeout> | null = null;
let ligadoAoNavegador = false;

function ganhoDesejado(): number {
  return volumeParaGanho(obterVolumeMusica()) * GANHO_MAXIMO_DA_MUSICA;
}

function deveTocar(ctx: AudioContext): boolean {
  return (
    pedidos > 0 &&
    somEstaLigado() &&
    obterVolumeMusica() > 0 &&
    document.visibilityState === 'visible' &&
    ctx.state === 'running'
  );
}

function iniciar(ctx: AudioContext): void {
  const grafo = montarGrafo(ctx);
  grafo.saida.gain.linearRampToValueAtTime(ganhoDesejado(), ctx.currentTime + ENTRADA_SUAVE_S);
  let compasso = 0;
  let proximoInicio = ctx.currentTime + ATRASO_INICIAL_S;
  const agendar = () => {
    while (proximoInicio < ctx.currentTime + ANTECEDENCIA_S) {
      tocarCompasso(grafo, compasso, proximoInicio);
      compasso += 1;
      proximoInicio += SEGUNDOS_POR_COMPASSO;
    }
  };
  agendar();
  execucao = { grafo, agendador: setInterval(agendar, INTERVALO_DO_AGENDADOR_MS) };
}

function parar(atual: Execucao): void {
  clearInterval(atual.agendador);
  const { ctx, saida, fontes } = atual.grafo;
  saida.gain.cancelScheduledValues(ctx.currentTime);
  saida.gain.setValueAtTime(saida.gain.value, ctx.currentTime);
  saida.gain.linearRampToValueAtTime(SILENCIO, ctx.currentTime + SAIDA_SUAVE_S);
  // As notas já agendadas soam no grafo antigo, que é desligado do alto-falante após o fade.
  const fimDoFade = ctx.currentTime + SAIDA_SUAVE_S;
  fontes.forEach((fonte) => fonte.stop(fimDoFade));
  setTimeout(() => saida.disconnect(), SAIDA_SUAVE_S * 1000 * 2);
  execucao = null;
}

function atualizar(): void {
  const ctx = obterContexto();
  if (ctx === null) return;
  const tocar = deveTocar(ctx);
  if (tocar && execucao === null) {
    iniciar(ctx);
    return;
  }
  if (!tocar && execucao !== null) {
    parar(execucao);
    return;
  }
  if (execucao !== null) {
    // Ajuste do volume com a música tocando: rampa curta para não estalar.
    execucao.grafo.saida.gain.setTargetAtTime(
      ganhoDesejado(),
      ctx.currentTime,
      CONSTANTE_DO_AJUSTE_DE_VOLUME_S,
    );
  }
}

/** Liga a música aos eventos que mudam a decisão de tocar; feito uma vez só por página. */
export function ligarMusicaAoNavegador(): void {
  if (ligadoAoNavegador) return;
  const ctx = obterContexto();
  if (ctx === null) return;
  ligadoAoNavegador = true;
  ctx.addEventListener('statechange', atualizar);
  document.addEventListener('visibilitychange', atualizar);
  assinarPreferencias(atualizar);
}

/** Pede a música enquanto uma tela que a quer estiver montada; devolve a liberação. */
export function pedirMusica(): () => void {
  pedidos += 1;
  if (carencia !== null) {
    clearTimeout(carencia);
    carencia = null;
  }
  atualizar();
  return () => {
    pedidos -= 1;
    if (pedidos > 0) return;
    carencia = setTimeout(() => {
      carencia = null;
      atualizar();
    }, CARENCIA_AO_TROCAR_DE_TELA_MS);
  };
}
