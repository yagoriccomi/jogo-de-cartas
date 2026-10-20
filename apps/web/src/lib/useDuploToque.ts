import { useCallback, useRef, type MouseEvent } from 'react';

/** Janela do segundo toque: mais devagar que isso, o toque só (re)seleciona. */
export const INTERVALO_DUPLO_CLIQUE_MS = 700;

/**
 * Padrão de todos os seletores da partida (cartas, palpite, reações): 1 toque seleciona,
 * 2 toques rápidos no mesmo item confirmam. Enter/Espaço (`detail === 0`) confirma direto,
 * porque no teclado não há como "tocar duas vezes rápido".
 */
export function useDuploToque<T>(
  selecionar: (valor: T) => void,
  confirmar: (valor: T, evento: MouseEvent<HTMLButtonElement>) => void,
): {
  readonly tocar: (valor: T, evento: MouseEvent<HTMLButtonElement>) => void;
  readonly esquecer: () => void;
} {
  const ultimo = useRef<{ valor: T; em: number } | null>(null);
  const esquecer = useCallback(() => {
    ultimo.current = null;
  }, []);
  const tocar = (valor: T, evento: MouseEvent<HTMLButtonElement>) => {
    const agora = Date.now();
    const anterior = ultimo.current;
    const duplo =
      anterior !== null &&
      anterior.valor === valor &&
      agora - anterior.em < INTERVALO_DUPLO_CLIQUE_MS;
    if (evento.detail === 0 || duplo) {
      ultimo.current = null;
      confirmar(valor, evento);
      return;
    }
    ultimo.current = { valor, em: agora };
    selecionar(valor);
  };
  return { tocar, esquecer };
}
