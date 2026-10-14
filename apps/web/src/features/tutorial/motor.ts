import { interceptarAcoes } from '../../estado/acoes';
import { atualizar, avisar, obterEstado } from '../../estado/armazem';
import { lerApelido } from '../../lib/sessao';
import { paraEstadoDaPartida, salaDoTutorial, SESSAO_DO_TUTORIAL } from './mesaDoTutorial';
import { montarRoteiro, type Passo } from './roteiro';

// "Você" ficaria "Você (você)" no resultado da rodada.
const APELIDO_PADRAO = 'Novato';

let roteiro: readonly Passo[] = [];
let temporizador: ReturnType<typeof setTimeout> | null = null;

export function passoAtual(): Passo | null {
  const tutorial = obterEstado().tutorial;
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

function irPara(indice: number): void {
  cancelarTemporizador();
  const passo = roteiro[indice];
  if (!passo) {
    encerrarTutorial();
    return;
  }
  const anterior = obterEstado().tutorial === null ? null : passoAtual();
  const mudouAMesa = anterior?.momento !== passo.momento;
  atualizar({
    tutorial: { passo: indice },
    // Só um momento novo conta como "estado recebido": evita reiniciar animações à toa.
    ...(mudouAMesa && { jogo: paraEstadoDaPartida(passo.momento), jogoRecebidoEm: Date.now() }),
  });
  if (passo.espera.tipo === 'tempo') {
    temporizador = setTimeout(() => irPara(indice + 1), passo.espera.ms);
  }
}

/** Botão do balão: só avança quando o passo espera por ele (os outros esperam a sua jogada). */
export function avancarTutorial(): void {
  const tutorial = obterEstado().tutorial;
  if (tutorial === null || passoAtual()?.espera.tipo !== 'botao') return;
  irPara(tutorial.passo + 1);
}

function seguirSe(acertou: boolean, dica: string): boolean {
  const tutorial = obterEstado().tutorial;
  if (tutorial === null) return false;
  if (!acertou) {
    avisar('info', dica);
    return false;
  }
  irPara(tutorial.passo + 1);
  return true;
}

export function iniciarTutorial(): void {
  const apelido = lerApelido().trim() || APELIDO_PADRAO;
  roteiro = montarRoteiro(apelido);
  interceptarAcoes({
    palpitar: (quantidade) => {
      const espera = passoAtual()?.espera;
      if (espera?.tipo !== 'palpite') return seguirSe(false, 'Siga o balão para continuar.');
      return seguirSe(quantidade === espera.valor, `No tutorial, escolha ${espera.valor}.`);
    },
    jogarCarta: (cartaId) => {
      const espera = passoAtual()?.espera;
      if (espera?.tipo !== 'jogar') return seguirSe(false, 'Siga o balão para continuar.');
      return seguirSe(
        cartaId === espera.carta.id,
        `No tutorial, jogue o ${espera.carta.valor} que o balão aponta.`,
      );
    },
    sair: encerrarTutorial,
  });
  atualizar({ sessao: SESSAO_DO_TUTORIAL, sala: salaDoTutorial(apelido), voltouAoLobby: false });
  irPara(0);
}

export function encerrarTutorial(): void {
  cancelarTemporizador();
  interceptarAcoes(null);
  roteiro = [];
  atualizar({ tutorial: null, sessao: null, sala: null, jogo: null });
}
