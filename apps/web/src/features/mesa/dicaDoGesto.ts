import { useCallback, useState } from 'react';
import { descreverErro, registrar } from '../../lib/log';

/** Cada seletor ensina o próprio gesto uma vez por aparelho, no primeiro uso. */
export type SeletorComDica = 'carta' | 'palpite' | 'reacao';

const PREFIXO_DA_CHAVE = 'fodinha:dica-do-gesto:';
const VALOR_APRENDIDO = 'aprendido';

// O localStorage pode lançar (modo privado, dados bloqueados): sem ele a dica só volta a aparecer.
function jaAprendeu(seletor: SeletorComDica): boolean {
  const chave = PREFIXO_DA_CHAVE + seletor;
  try {
    return localStorage.getItem(chave) === VALOR_APRENDIDO;
  } catch (erro) {
    registrar('warn', 'storage.leitura_falhou', { chave, ...descreverErro(erro) });
    return false;
  }
}

function marcarAprendido(seletor: SeletorComDica): void {
  const chave = PREFIXO_DA_CHAVE + seletor;
  try {
    localStorage.setItem(chave, VALOR_APRENDIDO);
  } catch (erro) {
    registrar('warn', 'storage.escrita_falhou', { chave, ...descreverErro(erro) });
  }
}

/** `destacar` até o jogador usar o seletor pela primeira vez; `aprendeu` encerra a dica de vez. */
export function useDicaDoGesto(seletor: SeletorComDica): {
  readonly destacar: boolean;
  readonly aprendeu: () => void;
} {
  const [destacar, definirDestacar] = useState(() => !jaAprendeu(seletor));
  const aprendeu = useCallback(() => {
    marcarAprendido(seletor);
    definirDestacar(false);
  }, [seletor]);
  return { destacar, aprendeu };
}
