import { descreverErro, registrar } from '../../lib/log';

const CHAVE_RESUMO = 'fodinha:resumo-das-regras';
const VALOR_DISPENSADO = 'dispensado';

// O localStorage pode lançar (modo privado, dados bloqueados): sem ele o resumo só volta a aparecer.
export function resumoDispensado(): boolean {
  try {
    return localStorage.getItem(CHAVE_RESUMO) === VALOR_DISPENSADO;
  } catch (erro) {
    registrar('warn', 'storage.leitura_falhou', { chave: CHAVE_RESUMO, ...descreverErro(erro) });
    return false;
  }
}

export function dispensarResumo(): void {
  try {
    localStorage.setItem(CHAVE_RESUMO, VALOR_DISPENSADO);
  } catch (erro) {
    registrar('warn', 'storage.escrita_falhou', { chave: CHAVE_RESUMO, ...descreverErro(erro) });
  }
}
