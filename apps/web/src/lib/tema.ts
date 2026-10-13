import { useCallback, useState } from 'react';
import { registrar, descreverErro } from './log';

export type PreferenciaTema = 'auto' | 'claro' | 'escuro';

const CHAVE_TEMA = 'fodinha:tema';
const CICLO: readonly PreferenciaTema[] = ['auto', 'claro', 'escuro'];

function lerPreferencia(): PreferenciaTema {
  try {
    const valor = localStorage.getItem(CHAVE_TEMA);
    return valor === 'claro' || valor === 'escuro' ? valor : 'auto';
  } catch {
    return 'auto';
  }
}

function aplicar(preferencia: PreferenciaTema): void {
  const raiz = document.documentElement;
  if (preferencia === 'auto') raiz.removeAttribute('data-tema');
  else raiz.setAttribute('data-tema', preferencia);
}

/** Chamada antes do primeiro render para evitar o "flash" do tema errado. */
export function aplicarTemaSalvo(): void {
  aplicar(lerPreferencia());
}

export function useTema(): { preferencia: PreferenciaTema; alternar: () => void } {
  const [preferencia, definir] = useState<PreferenciaTema>(lerPreferencia);

  const alternar = useCallback(() => {
    const proxima = CICLO[(CICLO.indexOf(preferencia) + 1) % CICLO.length] ?? 'auto';
    aplicar(proxima);
    definir(proxima);
    try {
      localStorage.setItem(CHAVE_TEMA, proxima);
    } catch (erro) {
      registrar('warn', 'tema.persistencia_falhou', descreverErro(erro));
    }
  }, [preferencia]);

  return { preferencia, alternar };
}
