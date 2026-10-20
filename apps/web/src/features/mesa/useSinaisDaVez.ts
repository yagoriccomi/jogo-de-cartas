import { useEffect, type RefObject } from 'react';
import { MARCADORES, prefereMenosMovimento } from './animacao-compartilhada';

const TITULO_DA_VEZ = '🔴 Sua vez! · Fodinha';

/**
 * Jogadores não percebiam a própria vez com a aba em segundo plano: o título da aba avisa até a
 * jogada sair. Restaura o título anterior ao sair da vez.
 */
export function useTituloDaVez(souDaVez: boolean): void {
  useEffect(() => {
    if (!souDaVez) return;
    const anterior = document.title;
    document.title = TITULO_DA_VEZ;
    return () => {
      document.title = anterior;
    };
  }, [souDaVez]);
}

/**
 * Com muitos adversários a faixa de placas rola (no celular só ~3 cabem): traz a placa de quem
 * está com a vez para a vista, sem rolar a página.
 */
export function useRolarAtePlacaDaVez(
  faixa: RefObject<HTMLUListElement>,
  idDaVez: string | null,
): void {
  useEffect(() => {
    const lista = faixa.current;
    if (lista === null || idDaVez === null) return;
    const placa = lista.querySelector<HTMLElement>(
      `[${MARCADORES.placaDoJogador}="${CSS.escape(idDaVez)}"]`,
    );
    if (placa === null) return;
    const r = placa.getBoundingClientRect();
    const deslocamento = r.left - lista.getBoundingClientRect().left + lista.scrollLeft;
    const centro = deslocamento + r.width / 2 - lista.clientWidth / 2;
    lista.scrollTo({ left: centro, behavior: prefereMenosMovimento() ? 'auto' : 'smooth' });
  }, [faixa, idDaVez]);
}
