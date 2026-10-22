import { obterContexto } from './contextoDeAudio';
import { assinarPreferencias, somEstaLigado, volumeDaMusica, volumeParaGanho } from './preferencia';

/*
 * Música de fundo "Jackpot Tranquilo", gerada na hora com Web Audio: city pop dos anos 80 com pé
 * na bossa — piano elétrico, baixo sincopado, aro de caixa, chocalho e sinos com eco, sob um
 * chiado leve de vinil. Gerar em vez de tocar um arquivo evita licença de terceiros e download
 * pesado; a progressão fica em loop, mas a melodia e os detalhes variam a cada volta.
 */

const BATIDAS_POR_MINUTO = 96;
const BATIDAS_POR_COMPASSO = 4;
const SEGUNDOS_POR_BATIDA = 60 / BATIDAS_POR_MINUTO;
const SEGUNDOS_POR_COMPASSO = SEGUNDOS_POR_BATIDA * BATIDAS_POR_COMPASSO;
const COLCHEIAS_POR_COMPASSO = BATIDAS_POR_COMPASSO * 2;
const SEMICOLCHEIAS_POR_COMPASSO = BATIDAS_POR_COMPASSO * 4;

/** Teto da música no volume 100. Abafada e sem harmônicos agudos, ela soa mais baixa que os efeitos
 * de onda quadrada mesmo com pico maior; no volume inicial (50%) fica claramente por baixo deles. */
const GANHO_MAXIMO_DA_MUSICA = 0.6;
/** Entrada lenta para a música não assustar quem acabou de tocar na tela. */
const ENTRADA_SUAVE_S = 3;
const SAIDA_SUAVE_S = 0.8;
const CONSTANTE_DO_AJUSTE_DE_VOLUME_S = 0.08;
/** Corta o brilho do conjunto: mantém o clima de rádio FM antiga e não cansa o ouvido. */
const CORTE_DO_ABAFADOR_HZ = 3200;

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
const QUINTA_JUSTA = 7;

/** Os primeiros compassos de cada entrada vêm sem batida, e a cada ciclo a batida respira. */
const COMPASSOS_SEM_BATIDA_NA_ENTRADA = 2;
const COMPASSOS_POR_CICLO = 16;
const COMPASSOS_DE_RESPIRO_NO_CICLO = 2;

// Ambiência: sala sintética e eco em colcheia pontuada, o "brilho de cassino" dos anos 80.
const ENVIO_DA_REVERBERACAO = 0.3;
const DURACAO_DA_REVERBERACAO_S = 2.6;
/** Expoente da cauda da reverberação: maior = some mais rápido, sala menos embolada. */
const QUEDA_DA_REVERBERACAO = 3;
const ENVIO_DO_ECO = 0.15;
const ECO_EM_BATIDAS = 0.75;
const ATRASO_MAXIMO_DO_ECO_S = 2;
const REALIMENTACAO_DO_ECO = 0.35;
const CORTE_DO_ECO_HZ = 1800;

/** Oscilação lenta de afinação, como uma fita que gira com velocidade irregular. */
const FREQUENCIA_DA_OSCILACAO_HZ = 0.35;
const PROFUNDIDADE_DA_OSCILACAO_CENTS = 4;

// Piano elétrico.
const GANHO_PIANO = 0.11;
const GANHO_REPIQUE_PIANO = 0.6;
const GANHO_BRILHO_PIANO = 0.25;
const ATAQUE_PIANO_S = 0.02;
const DEFASAGEM_DO_DEDILHADO_S = 0.025;
const DECAIMENTO_PIANO_S = 1.6;
const DECAIMENTO_BRILHO_S = 0.35;
const NIVEL_SUSTENTADO_PIANO = 0.35;
/** Quantas constantes de tempo de um `setTargetAtTime` até o som ficar inaudível. */
const CONSTANTES_ATE_SILENCIAR = 5;
/** O repique do acorde cai no "e" do 3º tempo: a antecipação típica do city pop. */
const POSICAO_DO_REPIQUE_BATIDAS = 2.5;
const CHANCE_DO_REPIQUE = 0.7;
const ENVIO_DO_ECO_PIANO = 0.5;

// Sinos da melodia.
const GANHO_SINO = 0.05;
const CHANCE_DE_NOTA_DA_MELODIA = 0.15;
const DURACAO_SINO_S = 1.6;
const ATAQUE_SINO_S = 0.005;
/** Parcial levemente desafinado acima da fundamental: é o que faz soar como sino, não flauta. */
const RAZAO_DO_PARCIAL_DO_SINO = 3.01;
const GANHO_DO_PARCIAL_DO_SINO = 0.18;

// Baixo sincopado da bossa: fundamental longa, quinta curta no contratempo.
const GANHO_BAIXO = 0.34;
const ATAQUE_BAIXO_S = 0.04;
const SOLTURA_BAIXO_S = 0.08;

// Percussão.
const GANHO_BUMBO_FORTE = 0.4;
const GANHO_BUMBO_FRACO = 0.25;
const DURACAO_BUMBO_S = 0.4;
const FREQUENCIA_INICIAL_BUMBO_HZ = 110;
const FREQUENCIA_FINAL_BUMBO_HZ = 42;
const QUEDA_BUMBO_S = 0.12;
const GANHO_ARO = 0.06;
const FREQUENCIA_ARO_HZ = 2600;
const DURACAO_ARO_S = 0.05;
const GANHO_CORPO_ARO = 0.04;
const FREQUENCIA_CORPO_ARO_HZ = 820;
const DURACAO_CORPO_ARO_S = 0.04;
const QUEDA_DO_CORPO_ARO = 0.7;
const GANHO_CHOCALHO_ACENTO = 0.022;
const GANHO_CHOCALHO = 0.01;
const CORTE_CHOCALHO_HZ = 7000;
const DURACAO_CHOCALHO_S = 0.04;

const GANHO_VINIL = 0.03;
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

/** I–vi–ii–V em dó com sétimas: o encadeamento clássico do city pop. */
const PROGRESSAO: readonly Acorde[] = [
  { baixo: 36, vozes: [52, 55, 59, 62] }, // Dó7M(9)
  { baixo: 45, vozes: [55, 60, 64, 67] }, // Lám7
  { baixo: 38, vozes: [53, 57, 60, 64] }, // Rém9
  { baixo: 43, vozes: [53, 57, 59, 64] }, // Sol13
];

/** Pentatônica de dó na 5ª oitava: qualquer nota soa bem sobre qualquer acorde da progressão. */
const ESCALA_DA_MELODIA: readonly number[] = [72, 74, 76, 79, 81, 84];

/** Baixo da bossa: [posição em batidas, intervalo sobre a fundamental, duração em batidas]. */
const LINHA_DO_BAIXO: readonly (readonly [number, number, number])[] = [
  [0, 0, 1.4],
  [1.5, QUINTA_JUSTA, 0.45],
  [2, 0, 1.4],
  [3.5, QUINTA_JUSTA, 0.45],
];
/** Bumbo acompanhando o baixo; os tempos fortes (1 e 3) batem mais. */
const BUMBO_EM_BATIDAS: readonly number[] = [0, 1.5, 2, 3.5];
/** Aro de caixa numa clave à brasileira, que dá o balanço sem precisar de swing. */
const ARO_EM_BATIDAS: readonly number[] = [0, 0.75, 1.5, 2.5, 3.25];
/** Acento do chocalho na semicolcheia "e" de cada tempo. */
const SEMICOLCHEIAS_POR_BATIDA = 4;
const SEMICOLCHEIA_ACENTUADA = 2;

function frequenciaDa(notaMidi: number): number {
  return FREQUENCIA_LA4_HZ * 2 ** ((notaMidi - NOTA_LA4_MIDI) / NOTAS_POR_OITAVA);
}

function sortear<T>(itens: readonly T[]): T | undefined {
  return itens[Math.floor(Math.random() * itens.length)];
}

function emSegundos(batidas: number): number {
  return batidas * SEGUNDOS_POR_BATIDA;
}

interface Grafo {
  readonly ctx: AudioContext;
  /** Volume do jogador; o único nó ligado ao alto-falante. */
  readonly saida: GainNode;
  /** Tudo que é tocado passa por aqui antes da saída. */
  readonly abafador: BiquadFilterNode;
  readonly envioReverberacao: GainNode;
  readonly envioEco: GainNode;
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

/** Sala sintética: ruído estéreo que decai, usado como resposta ao impulso da reverberação. */
function criarSala(ctx: AudioContext): AudioBuffer {
  const canais = 2;
  const bufer = ctx.createBuffer(
    canais,
    ctx.sampleRate * DURACAO_DA_REVERBERACAO_S,
    ctx.sampleRate,
  );
  for (let canal = 0; canal < canais; canal++) {
    const amostras = bufer.getChannelData(canal);
    for (let i = 0; i < amostras.length; i++) {
      const cauda = (1 - i / amostras.length) ** QUEDA_DA_REVERBERACAO;
      amostras[i] = (Math.random() * 2 - 1) * cauda;
    }
  }
  return bufer;
}

function montarAmbiencia(ctx: AudioContext, abafador: BiquadFilterNode) {
  const reverberacao = ctx.createConvolver();
  reverberacao.buffer = criarSala(ctx);
  const envioReverberacao = ctx.createGain();
  envioReverberacao.gain.value = ENVIO_DA_REVERBERACAO;
  envioReverberacao.connect(reverberacao).connect(abafador);

  const eco = ctx.createDelay(ATRASO_MAXIMO_DO_ECO_S);
  eco.delayTime.value = emSegundos(ECO_EM_BATIDAS);
  const filtroEco = ctx.createBiquadFilter();
  filtroEco.type = 'lowpass';
  filtroEco.frequency.value = CORTE_DO_ECO_HZ;
  const realimentacao = ctx.createGain();
  realimentacao.gain.value = REALIMENTACAO_DO_ECO;
  // Cada repetição volta mais escura e mais baixa, como num eco de fita.
  eco.connect(filtroEco).connect(realimentacao).connect(eco);
  filtroEco.connect(abafador);
  const envioEco = ctx.createGain();
  envioEco.gain.value = ENVIO_DO_ECO;
  envioEco.connect(eco);

  return { envioReverberacao, envioEco };
}

function montarGrafo(ctx: AudioContext): Grafo {
  const saida = ctx.createGain();
  saida.gain.setValueAtTime(SILENCIO, ctx.currentTime);
  saida.connect(ctx.destination);

  const abafador = ctx.createBiquadFilter();
  abafador.type = 'lowpass';
  abafador.frequency.value = CORTE_DO_ABAFADOR_HZ;
  abafador.connect(saida);

  const { envioReverberacao, envioEco } = montarAmbiencia(ctx, abafador);

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

  return {
    ctx,
    saida,
    abafador,
    envioReverberacao,
    envioEco,
    oscilacao,
    fontes: [lfo, vinil],
    ruido: criarRuido(ctx),
  };
}

/** Manda uma voz para a mistura, com um pouco de sala e, na fração pedida, de eco. */
function conectar(grafo: Grafo, no: AudioNode, fracaoDoEco: number): void {
  no.connect(grafo.abafador);
  no.connect(grafo.envioReverberacao);
  if (fracaoDoEco <= 0) return;
  const envio = grafo.ctx.createGain();
  envio.gain.value = fracaoDoEco;
  no.connect(envio).connect(grafo.envioEco);
}

/** Oscilador afinado que segue a oscilação de fita e se solta dela ao terminar. */
function osciladorAfinado(grafo: Grafo, tipo: OscillatorType, freq: number): OscillatorNode {
  const oscilador = grafo.ctx.createOscillator();
  oscilador.type = tipo;
  oscilador.frequency.value = freq;
  grafo.oscilacao.connect(oscilador.detune);
  // A ligação vinda da oscilação de fita prenderia cada nota tocada na memória para sempre.
  oscilador.onended = () => grafo.oscilacao.disconnect(oscilador.detune);
  return oscilador;
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
  conectar(grafo, envelope, ENVIO_DO_ECO_PIANO);

  const fundamental = osciladorAfinado(grafo, 'sine', nota.freq);
  fundamental.connect(envelope);

  const brilho = osciladorAfinado(grafo, 'triangle', nota.freq * 2);
  const ganhoBrilho = ctx.createGain();
  ganhoBrilho.gain.setValueAtTime(GANHO_BRILHO_PIANO, nota.inicio);
  ganhoBrilho.gain.setTargetAtTime(0, nota.inicio, DECAIMENTO_BRILHO_S / 3);
  brilho.connect(ganhoBrilho).connect(envelope);

  // Só para depois do fade ter chegado a quase zero; parar antes causa estalo.
  const parada = nota.fim + DECAIMENTO_BRILHO_S * CONSTANTES_ATE_SILENCIAR;
  for (const oscilador of [fundamental, brilho]) {
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

function tocarSino(grafo: Grafo, freq: number, inicio: number): void {
  const fim = inicio + DURACAO_SINO_S;
  const envelope = grafo.ctx.createGain();
  envelope.gain.setValueAtTime(SILENCIO, inicio);
  envelope.gain.linearRampToValueAtTime(GANHO_SINO, inicio + ATAQUE_SINO_S);
  envelope.gain.exponentialRampToValueAtTime(SILENCIO, fim);
  conectar(grafo, envelope, 1);

  const parcial = grafo.ctx.createGain();
  parcial.gain.value = GANHO_DO_PARCIAL_DO_SINO;
  const fundamental = osciladorAfinado(grafo, 'sine', freq);
  const harmonico = osciladorAfinado(grafo, 'sine', freq * RAZAO_DO_PARCIAL_DO_SINO);
  fundamental.connect(envelope);
  harmonico.connect(parcial).connect(envelope);
  for (const oscilador of [fundamental, harmonico]) {
    oscilador.start(inicio);
    oscilador.stop(fim);
  }
}

function tocarBaixo(grafo: Grafo, notaMidi: number, inicio: number, duracao: number): void {
  const { ctx } = grafo;
  const fim = inicio + duracao;
  const oscilador = osciladorAfinado(grafo, 'sine', frequenciaDa(notaMidi));
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(SILENCIO, inicio);
  envelope.gain.linearRampToValueAtTime(GANHO_BAIXO, inicio + ATAQUE_BAIXO_S);
  envelope.gain.setTargetAtTime(SILENCIO, fim - SOLTURA_BAIXO_S, SOLTURA_BAIXO_S);
  oscilador.connect(envelope).connect(grafo.abafador);
  oscilador.start(inicio);
  oscilador.stop(fim + SOLTURA_BAIXO_S * CONSTANTES_ATE_SILENCIAR);
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

/** Aro de caixa: estalo de ruído + um corpo tonal curto que cai de afinação. */
function tocarAro(grafo: Grafo, inicio: number): void {
  tocarRuido(grafo, inicio, {
    filtro: 'bandpass',
    frequencia: FREQUENCIA_ARO_HZ,
    duracao: DURACAO_ARO_S,
    ganho: GANHO_ARO,
  });
  const { ctx } = grafo;
  const corpo = ctx.createOscillator();
  corpo.frequency.setValueAtTime(FREQUENCIA_CORPO_ARO_HZ, inicio);
  corpo.frequency.exponentialRampToValueAtTime(
    FREQUENCIA_CORPO_ARO_HZ * QUEDA_DO_CORPO_ARO,
    inicio + DURACAO_CORPO_ARO_S,
  );
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(GANHO_CORPO_ARO, inicio);
  envelope.gain.exponentialRampToValueAtTime(SILENCIO, inicio + DURACAO_CORPO_ARO_S);
  corpo.connect(envelope);
  conectar(grafo, envelope, 0);
  corpo.start(inicio);
  corpo.stop(inicio + DURACAO_CORPO_ARO_S * 2);
}

function tocarBatida(grafo: Grafo, inicio: number): void {
  for (const batida of BUMBO_EM_BATIDAS) {
    const forte = Number.isInteger(batida) && batida % 2 === 0;
    tocarBumbo(grafo, inicio + emSegundos(batida), forte ? GANHO_BUMBO_FORTE : GANHO_BUMBO_FRACO);
  }
  for (const batida of ARO_EM_BATIDAS) tocarAro(grafo, inicio + emSegundos(batida));
  for (let i = 0; i < SEMICOLCHEIAS_POR_COMPASSO; i++) {
    const acento = i % SEMICOLCHEIAS_POR_BATIDA === SEMICOLCHEIA_ACENTUADA;
    tocarRuido(grafo, inicio + emSegundos(i / SEMICOLCHEIAS_POR_BATIDA), {
      filtro: 'highpass',
      frequencia: CORTE_CHOCALHO_HZ,
      duracao: DURACAO_CHOCALHO_S,
      ganho: acento ? GANHO_CHOCALHO_ACENTO : GANHO_CHOCALHO,
    });
  }
}

function tocarMelodia(grafo: Grafo, inicio: number): void {
  for (let colcheia = 0; colcheia < COLCHEIAS_POR_COMPASSO; colcheia++) {
    if (Math.random() >= CHANCE_DE_NOTA_DA_MELODIA) continue;
    const nota = sortear(ESCALA_DA_MELODIA);
    if (nota === undefined) continue;
    tocarSino(grafo, frequenciaDa(nota), inicio + emSegundos(colcheia / 2));
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
    const repique = inicio + emSegundos(POSICAO_DO_REPIQUE_BATIDAS);
    tocarAcorde(grafo, acorde, { inicio: repique, fim, ganho: GANHO_PIANO * GANHO_REPIQUE_PIANO });
  }
  for (const [batida, intervalo, duracao] of LINHA_DO_BAIXO) {
    tocarBaixo(grafo, acorde.baixo + intervalo, inicio + emSegundos(batida), emSegundos(duracao));
  }
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
  return volumeParaGanho(volumeDaMusica.obter()) * GANHO_MAXIMO_DA_MUSICA;
}

function deveTocar(ctx: AudioContext): boolean {
  return (
    pedidos > 0 &&
    somEstaLigado() &&
    volumeDaMusica.obter() > 0 &&
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
