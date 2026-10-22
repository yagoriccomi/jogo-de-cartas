import { atualizar, avisar, obterEstado, type EstadoApp } from '../../estado/armazem';
import {
  FONTE_DO_SERVIDOR,
  type AcoesDaPartida,
  type FonteDaPartida,
} from '../../estado/fonteDaPartida';
import { lerApelido } from '../../lib/sessao';
import { paraEstadoDaPartida, salaDoTutorial, SESSAO_DO_TUTORIAL } from './mesaDoTutorial';
import { montarRoteiro, type Passo } from './roteiro';

// "Você" ficaria "Você (você)" no resultado da rodada.
const APELIDO_PADRAO = 'Novato';
const SIGA_O_BALAO = 'Siga o balão para continuar.';
/** Resposta às ações que o roteiro não ensina (a interface nem as oferece no tutorial). */
const SO_NA_PARTIDA_DE_VERDADE = 'Isso só funciona numa partida de verdade.';

let roteiro: readonly Passo[] = [];
let temporizador: ReturnType<typeof setTimeout> | null = null;

type FonteDoTutorial = Extract<FonteDaPartida, { origem: 'tutorial' }>;

function fonteDoTutorial(): FonteDoTutorial | null {
  const { fonte } = obterEstado();
  return fonte.origem === 'tutorial' ? fonte : null;
}

export function passoAtual(): Passo | null {
  const tutorial = fonteDoTutorial();
  return tutorial === null ? null : (roteiro[tutorial.passo] ?? null);
}

export function totalDePassos(): number {
  return roteiro.length;
}

function cancelarTemporizador(): void {
  if (temporizador === null) return;
  clearTimeout(temporizador);
  temporizador = null;
}

/** `abertura` entra na mesma atualização do primeiro passo: a fonte e a sessão trocam juntas. */
function irPara(indice: number, abertura: Partial<EstadoApp> = {}): void {
  cancelarTemporizador();
  const passo = roteiro[indice];
  if (!passo) {
    encerrarTutorial();
    return;
  }
  const anterior = passoAtual();
  const mudouAMesa = anterior?.momento !== passo.momento;
  atualizar({
    ...abertura,
    fonte: { origem: 'tutorial', passo: indice, acoes: acoesDoTutorial },
    // Só um momento novo conta como "estado recebido": evita reiniciar animações à toa.
    ...(mudouAMesa && { jogo: paraEstadoDaPartida(passo.momento), jogoRecebidoEm: Date.now() }),
  });
  if (passo.espera.tipo === 'tempo') {
    temporizador = setTimeout(() => irPara(indice + 1), passo.espera.ms);
  }
}

/** Botão do balão: só avança quando o passo espera por ele (os outros esperam a sua jogada). */
export function avancarTutorial(): void {
  const tutorial = fonteDoTutorial();
  if (tutorial === null || passoAtual()?.espera.tipo !== 'botao') return;
  irPara(tutorial.passo + 1);
}

/** Versão rápida: tira os passos só explicativos que ainda estão por vir e segue. */
export function avancarTutorialRapido(): void {
  const tutorial = fonteDoTutorial();
  if (tutorial === null || passoAtual()?.espera.tipo !== 'botao') return;
  const feitos = roteiro.slice(0, tutorial.passo + 1);
  const restantes = roteiro.slice(tutorial.passo + 1).filter((passo) => !passo.opcional);
  roteiro = [...feitos, ...restantes];
  irPara(tutorial.passo + 1);
}

function seguirSe(acertou: boolean, dica: string): Promise<boolean> {
  const tutorial = fonteDoTutorial();
  if (tutorial === null) return Promise.resolve(false);
  if (!acertou) {
    avisar('info', dica);
    return Promise.resolve(false);
  }
  irPara(tutorial.passo + 1);
  return Promise.resolve(true);
}

function recusar(): Promise<boolean> {
  avisar('info', SO_NA_PARTIDA_DE_VERDADE);
  return Promise.resolve(false);
}

/**
 * O roteiro no lugar do servidor. Responde a todas as ações: as que o roteiro ensina (palpitar,
 * jogar, sair) seguem o balão; as demais são recusadas aqui, sem nunca chegar ao socket.
 */
export const acoesDoTutorial: AcoesDaPartida = {
  sair: () => {
    encerrarTutorial();
    return Promise.resolve();
  },
  palpitar: (quantidade) => {
    const espera = passoAtual()?.espera;
    if (espera?.tipo !== 'palpite') return seguirSe(false, SIGA_O_BALAO);
    return seguirSe(quantidade === espera.valor, `No tutorial, escolha ${espera.valor}.`);
  },
  jogarCarta: (cartaId) => {
    const espera = passoAtual()?.espera;
    if (espera?.tipo !== 'jogar') return seguirSe(false, SIGA_O_BALAO);
    return seguirSe(
      cartaId === espera.carta.id,
      `No tutorial, jogue o ${espera.carta.valor} que o balão aponta.`,
    );
  },
  // Sem pausa para ler: o tutorial já anda no ritmo de quem lê (o resumo nem abre nele).
  lerRegras: () => Promise.resolve(false),
  pararDeLerRegras: () => Promise.resolve(true),
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

export function iniciarTutorial(): void {
  const apelido = lerApelido().trim() || APELIDO_PADRAO;
  roteiro = montarRoteiro(apelido);
  irPara(0, { sessao: SESSAO_DO_TUTORIAL, sala: salaDoTutorial(apelido), voltouAoLobby: false });
}

export function encerrarTutorial(): void {
  cancelarTemporizador();
  roteiro = [];
  atualizar({ fonte: FONTE_DO_SERVIDOR, sessao: null, sala: null, jogo: null });
}
