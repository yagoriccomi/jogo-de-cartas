import type { EstadoPartidaVisivel } from '@fodinha/shared';
import { chaveDaVaza } from '../mesa/cenaDaVaza';
import { idDaVezAtiva } from '../mesa/visaoDaMesa';

/** O que mudou na mesa entre dois estados e merece um som (ou vibração). */
export type EventoDaMesa =
  | 'cartaJogada'
  | 'minhaVez'
  | 'vazaMinha'
  | 'vazaDeOutro'
  | 'vazaAnulada'
  | 'perdiVida'
  | 'palpiteConfirmado'
  | 'novaRodada'
  | 'vitoria'
  | 'derrota';

function ehMinhaVez(estado: EstadoPartidaVisivel, meuId: string): boolean {
  return idDaVezAtiva(estado) === meuId;
}

/**
 * Compara dois estados consecutivos e lista o que aconteceu, na ordem em que deve soar.
 * Pura de propósito: não toca em áudio, relógio nem DOM.
 */
export function detectarEventos(
  anterior: EstadoPartidaVisivel,
  atual: EstadoPartidaVisivel,
  meuId: string,
): readonly EventoDaMesa[] {
  const eventos: EventoDaMesa[] = [];

  if (atual.numeroRodada !== anterior.numeroRodada) eventos.push('novaRodada');

  const vazaFechada =
    atual.ultimaVaza !== null && chaveDaVaza(atual.ultimaVaza) !== chaveDaVaza(anterior.ultimaVaza);
  // A última carta da vaza chega no mesmo estado que limpa a mesa, então só o fechamento a revela.
  const cartaChegou = atual.mesa.length > anterior.mesa.length;
  if (cartaChegou || vazaFechada) eventos.push('cartaJogada');

  if (atual.ultimaVaza !== null && vazaFechada) {
    if (atual.ultimaVaza.vencedorId === null) eventos.push('vazaAnulada');
    else eventos.push(atual.ultimaVaza.vencedorId === meuId ? 'vazaMinha' : 'vazaDeOutro');
  }

  const euAntes = anterior.jogadores.find((jogador) => jogador.id === meuId);
  const euAgora = atual.jogadores.find((jogador) => jogador.id === meuId);

  const encerrou = atual.fase === 'encerrada' && anterior.fase !== 'encerrada';
  if (encerrou) {
    // Só quem estava na mesa tem fanfarra ou lamento; espectador não ouve nada.
    if (euAgora !== undefined) {
      eventos.push(atual.vencedores.includes(meuId) ? 'vitoria' : 'derrota');
    }
    return eventos;
  }

  if (euAntes !== undefined && euAgora !== undefined) {
    if (euAgora.vidas < euAntes.vidas) eventos.push('perdiVida');
    if (euAntes.palpite === null && euAgora.palpite !== null) eventos.push('palpiteConfirmado');
  }

  const viraMinhaVez =
    ehMinhaVez(atual, meuId) && (!ehMinhaVez(anterior, meuId) || anterior.fase !== atual.fase);
  if (viraMinhaVez) eventos.push('minhaVez');

  return eventos;
}
