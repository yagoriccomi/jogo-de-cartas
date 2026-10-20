import { useEffect } from 'react';
import { somEstaLigado } from './preferencia';
import { tocarTicTac } from './sintetizador';

/** Um tique por segundo enquanto `ativo`; alterna o tom (tic, tac) pela paridade do segundo. */
export function useTicTac(segundos: number, ativo: boolean): void {
  useEffect(() => {
    if (!ativo || !somEstaLigado()) return;
    tocarTicTac(segundos % 2 === 0);
  }, [segundos, ativo]);
}
