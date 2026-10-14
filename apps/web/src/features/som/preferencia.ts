import { useSyncExternalStore } from 'react';
import { descreverErro, registrar } from '../../lib/log';

const CHAVE_SOM = 'fodinha:som';
const VALOR_DESLIGADO = 'off';

// O localStorage pode lançar (modo privado, dados bloqueados): o som precisa funcionar sem ele.
function lerPreferencia(): boolean {
  try {
    return localStorage.getItem(CHAVE_SOM) !== VALOR_DESLIGADO;
  } catch (erro) {
    registrar('warn', 'storage.leitura_falhou', { chave: CHAVE_SOM, ...descreverErro(erro) });
    return true;
  }
}

function gravarPreferencia(ligado: boolean): void {
  try {
    if (ligado) localStorage.removeItem(CHAVE_SOM);
    else localStorage.setItem(CHAVE_SOM, VALOR_DESLIGADO);
  } catch (erro) {
    registrar('warn', 'storage.escrita_falhou', { chave: CHAVE_SOM, ...descreverErro(erro) });
  }
}

// Vive no módulo para o menu e o hook da mesa enxergarem o mesmo valor, mesmo sem o storage.
let somLigado = lerPreferencia();
const ouvintes = new Set<() => void>();

export function somEstaLigado(): boolean {
  return somLigado;
}

export function definirSomLigado(ligado: boolean): void {
  somLigado = ligado;
  gravarPreferencia(ligado);
  ouvintes.forEach((ouvinte) => ouvinte());
}

function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function useSomLigado(): boolean {
  return useSyncExternalStore(assinar, somEstaLigado);
}
