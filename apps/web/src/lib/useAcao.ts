import { useCallback, useRef, useState } from 'react';

/** Evita envio duplicado (duplo clique) e expõe o estado "ocupado" para desabilitar botões. */
export function useAcao(): [boolean, (acao: () => Promise<unknown>) => Promise<void>] {
  const [ocupado, definirOcupado] = useState(false);
  const emAndamento = useRef(false);

  const executar = useCallback(async (acao: () => Promise<unknown>) => {
    if (emAndamento.current) return;
    emAndamento.current = true;
    definirOcupado(true);
    try {
      await acao();
    } finally {
      emAndamento.current = false;
      definirOcupado(false);
    }
  }, []);

  return [ocupado, executar];
}
