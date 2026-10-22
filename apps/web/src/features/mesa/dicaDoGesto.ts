import { useCallback } from 'react';
import { declararMarcaDoAparelho, usePreferencia, type Preferencia } from '../../lib/preferencia';

/** Cada seletor ensina o próprio gesto uma vez por aparelho, no primeiro uso. */
export type SeletorComDica = 'carta' | 'palpite' | 'reacao';

const PREFIXO_DA_CHAVE = 'fodinha:dica-do-gesto:';
const VALOR_APRENDIDO = 'aprendido';

const aprendido = (seletor: SeletorComDica): Preferencia<boolean> =>
  declararMarcaDoAparelho(PREFIXO_DA_CHAVE + seletor, VALOR_APRENDIDO);

const GESTO_APRENDIDO: Readonly<Record<SeletorComDica, Preferencia<boolean>>> = {
  carta: aprendido('carta'),
  palpite: aprendido('palpite'),
  reacao: aprendido('reacao'),
};

/** `destacar` até o jogador usar o seletor pela primeira vez; `aprendeu` encerra a dica de vez. */
export function useDicaDoGesto(seletor: SeletorComDica): {
  readonly destacar: boolean;
  readonly aprendeu: () => void;
} {
  const marca = GESTO_APRENDIDO[seletor];
  const destacar = !usePreferencia(marca);
  // Chamado a cada uso do seletor: só a primeira vez precisa gravar.
  const aprendeu = useCallback(() => {
    if (!marca.obter()) marca.definir(true);
  }, [marca]);
  return { destacar, aprendeu };
}
