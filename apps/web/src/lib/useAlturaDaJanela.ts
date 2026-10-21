import { useSyncExternalStore } from 'react';

function assinar(avisar: () => void) {
  window.addEventListener('resize', avisar);
  return () => window.removeEventListener('resize', avisar);
}

/** Altura da janela, atualizada ao redimensionar ou girar o aparelho (0 fora do navegador). */
export function useAlturaDaJanela(): number {
  return useSyncExternalStore(
    assinar,
    () => window.innerHeight,
    () => 0,
  );
}
