import { useCallback, useSyncExternalStore } from 'react';

/** Reage a uma media query (ex.: layout de computador, tela de toque). Sem `matchMedia`, vale `false`. */
export function useMediaQuery(consulta: string): boolean {
  const assinar = useCallback(
    (avisar: () => void) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const lista = window.matchMedia(consulta);
      lista.addEventListener('change', avisar);
      return () => lista.removeEventListener('change', avisar);
    },
    [consulta],
  );
  const ler = useCallback(
    () => typeof window.matchMedia === 'function' && window.matchMedia(consulta).matches,
    [consulta],
  );
  return useSyncExternalStore(assinar, ler, () => false);
}

/** Largura a partir da qual a mesa usa o layout de computador. */
export const CONSULTA_COMPUTADOR = '(min-width: 900px)';
/** Aparelhos de toque: o clique em carta vira "seleciona, toque de novo para jogar". */
export const CONSULTA_TOQUE = '(pointer: coarse)';
