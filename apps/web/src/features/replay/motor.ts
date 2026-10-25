import type { EstadoPartidaVisivel } from '@fodinha/shared';
import { atualizar, avisar, obterEstado } from '../../estado/armazem';
import {
  FONTE_DO_SERVIDOR,
  type AcoesDaPartida,
  type FonteDaPartida,
} from '../../estado/fonteDaPartida';
import { buscarRodadaDoReplay } from './historico';
import {
  esperaDoLance,
  INICIO_DO_REPLAY,
  posicaoAnterior,
  proximaPosicao,
  pularRodada,
  resolverLance,
  type PosicaoNoReplay,
} from './linhaDoTempo';
import { salaDoReplay, sessaoDoReplay } from './mesaDoReplay';

/**
 * O replay no lugar do servidor: baixa uma rodada por vez (a próxima já vem adiantada) e entrega
 * à mesa de verdade um lance gravado por vez. Responde a todas as ações recusando as de jogo.
 */

type FonteDoReplay = Extract<FonteDaPartida, { origem: 'replay' }>;

const SO_ASSISTINDO = 'No replay você só assiste: a partida já terminou.';

const rodadas = new Map<number, readonly EstadoPartidaVisivel[]>();
let temporizador: ReturnType<typeof setTimeout> | null = null;
// Cada abertura (e cada saída) muda a geração: resposta de uma busca antiga é descartada.
let geracao = 0;

function fonteDoReplay(): FonteDoReplay | null {
  const { fonte } = obterEstado();
  return fonte.origem === 'replay' ? fonte : null;
}

function cancelarTemporizador(): void {
  if (temporizador === null) return;
  clearTimeout(temporizador);
  temporizador = null;
}

/** Busca (ou acha no cache) os lances de uma rodada; `null` = falhou e o aviso já apareceu. */
async function lancesDa(
  idPartida: string,
  numero: number,
  silencioso = false,
): Promise<readonly EstadoPartidaVisivel[] | null> {
  const guardada = rodadas.get(numero);
  if (guardada) return guardada;
  const resposta = await buscarRodadaDoReplay(idPartida, numero);
  if (!resposta.ok) {
    if (!silencioso) avisar('erro', resposta.mensagem);
    return null;
  }
  rodadas.set(numero, resposta.dados.lances);
  return resposta.dados.lances;
}

function adiantarProxima(fonte: FonteDoReplay): void {
  const proxima = fonte.rodada + 1;
  if (proxima > fonte.totalDeRodadas || rodadas.has(proxima)) return;
  // Falha aqui é silenciosa: se a rodada faltar de verdade, a navegação busca de novo e avisa.
  void lancesDa(fonte.idPartida, proxima, true);
}

function agendarPlay(): void {
  cancelarTemporizador();
  const fonte = fonteDoReplay();
  const lances = fonte && rodadas.get(fonte.rodada);
  const lance = lances?.[fonte?.lance ?? 0];
  if (!fonte?.tocando || !lances || !lance) return;
  const anterior = lances[fonte.lance - 1] ?? null;
  temporizador = setTimeout(() => void proximoLance(), esperaDoLance(lance, anterior));
}

/** Leva a mesa ao lance pedido; `tocando` segue como estava, salvo se a partida acabou. */
async function irPara(destino: PosicaoNoReplay): Promise<void> {
  const fonte = fonteDoReplay();
  if (!fonte) return;
  cancelarTemporizador();
  const minhaGeracao = geracao;
  if (!rodadas.has(destino.rodada)) atualizar({ fonte: { ...fonte, carregando: true } });
  const lances = await lancesDa(fonte.idPartida, destino.rodada);
  const atual = fonteDoReplay();
  if (minhaGeracao !== geracao || !atual) return;
  if (!lances) {
    atualizar({ fonte: { ...atual, carregando: false, tocando: false } });
    return;
  }
  const lance = resolverLance(destino.lance, lances.length);
  const jogo = lances[lance];
  if (!jogo) return;
  const proximo: FonteDoReplay = {
    ...atual,
    rodada: destino.rodada,
    lance,
    lancesNaRodada: lances.length,
    carregando: false,
  };
  atualizar({
    fonte: proximo,
    jogo,
    jogoRecebidoEm: Date.now(),
    // Assentos novos (quem entrou no meio) só aparecem na rodada em que sentaram.
    ...(destino.rodada !== atual.rodada && { sala: salaDoReplay(jogo) }),
  });
  adiantarProxima(proximo);
  agendarPlay();
}

export async function proximoLance(): Promise<void> {
  const fonte = fonteDoReplay();
  if (!fonte || fonte.carregando) return;
  const destino = proximaPosicao(fonte, fonte.lancesNaRodada, fonte.totalDeRodadas);
  if (destino) return irPara(destino);
  // Fim da partida: o play para sozinho no último lance.
  cancelarTemporizador();
  atualizar({ fonte: { ...fonte, tocando: false } });
}

export async function lanceAnterior(): Promise<void> {
  const fonte = fonteDoReplay();
  if (!fonte || fonte.carregando) return;
  const destino = posicaoAnterior(fonte);
  if (destino) await irPara(destino);
}

export async function pularParaProximaRodada(): Promise<void> {
  const fonte = fonteDoReplay();
  if (!fonte || fonte.carregando) return;
  const destino = pularRodada(fonte, fonte.totalDeRodadas);
  if (destino) await irPara(destino);
}

export function alternarPlay(): void {
  const fonte = fonteDoReplay();
  if (!fonte) return;
  const tocando = !fonte.tocando;
  const noFim =
    proximaPosicao(fonte, fonte.lancesNaRodada, fonte.totalDeRodadas) === null && tocando;
  atualizar({ fonte: { ...fonte, tocando } });
  // Play no último lance recomeça do início, como um vídeo.
  if (noFim) void irPara(INICIO_DO_REPLAY);
  else agendarPlay();
}

function recusar(): Promise<boolean> {
  avisar('info', SO_ASSISTINDO);
  return Promise.resolve(false);
}

export const acoesDoReplay: AcoesDaPartida = {
  sair: () => {
    encerrarReplay();
    return Promise.resolve();
  },
  // O resumo das regras nem abre no replay; se abrisse, não teria mesa para pausar.
  lerRegras: () => Promise.resolve(false),
  pararDeLerRegras: () => Promise.resolve(true),
  palpitar: recusar,
  jogarCarta: recusar,
  configurarSala: recusar,
  definirMortosVeemCartas: recusar,
  adicionarBot: recusar,
  expulsarParticipante: recusar,
  iniciarPartida: recusar,
  reiniciarSala: recusar,
  pausarPartida: recusar,
  retomarPartida: recusar,
  votarEspera: recusar,
  reagir: recusar,
};

/** Abre a partida na primeira rodada, parada. `false` = não abriu (o aviso já apareceu). */
export async function iniciarReplay(idPartida: string): Promise<boolean> {
  encerrarReplay();
  const minhaGeracao = geracao;
  const resposta = await buscarRodadaDoReplay(idPartida, INICIO_DO_REPLAY.rodada);
  if (minhaGeracao !== geracao) return false;
  if (!resposta.ok) {
    avisar('erro', resposta.mensagem);
    return false;
  }
  const { lances, totalDeRodadas, jogadorId } = resposta.dados;
  const [jogo] = lances;
  if (!jogo) {
    avisar('erro', 'Esta partida não tem lances para rever.');
    return false;
  }
  rodadas.set(INICIO_DO_REPLAY.rodada, lances);
  const fonte: FonteDoReplay = {
    origem: 'replay',
    idPartida,
    totalDeRodadas,
    ...INICIO_DO_REPLAY,
    lancesNaRodada: lances.length,
    tocando: false,
    carregando: false,
    acoes: acoesDoReplay,
  };
  atualizar({
    fonte,
    sessao: sessaoDoReplay(jogadorId),
    sala: salaDoReplay(jogo),
    jogo,
    jogoRecebidoEm: Date.now(),
    voltouAoLobby: false,
    reacoes: [],
  });
  adiantarProxima(fonte);
  return true;
}

export function encerrarReplay(): void {
  geracao++;
  cancelarTemporizador();
  rodadas.clear();
  if (!fonteDoReplay()) return;
  atualizar({ fonte: FONTE_DO_SERVIDOR, sessao: null, sala: null, jogo: null });
}
