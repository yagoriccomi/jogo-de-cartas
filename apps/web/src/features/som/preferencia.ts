import { useSyncExternalStore } from 'react';
import { descreverErro, registrar } from '../../lib/log';

const CHAVE_SOM = 'fodinha:som';
const VALOR_DESLIGADO = 'off';
const CHAVE_VOLUME_MUSICA = 'fodinha:volume-musica';
const CHAVE_VOLUME_EFEITOS = 'fodinha:volume-efeitos';
const CHAVE_VOLUME_REACOES = 'fodinha:volume-reacoes';

export const VOLUME_MINIMO = 0;
export const VOLUME_MAXIMO = 100;
/** Todo som começa no meio para não incomodar quem abre o jogo; cada um sobe no menu se quiser. */
const VOLUME_INICIAL = 50;
export const VOLUME_INICIAL_MUSICA = VOLUME_INICIAL;
export const VOLUME_INICIAL_EFEITOS = VOLUME_INICIAL;
export const VOLUME_INICIAL_REACOES = VOLUME_INICIAL;

// O localStorage pode lançar (modo privado, dados bloqueados): o som precisa funcionar sem ele.
function lerTexto(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch (erro) {
    registrar('warn', 'storage.leitura_falhou', { chave, ...descreverErro(erro) });
    return null;
  }
}

function gravarTexto(chave: string, valor: string | null): void {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, valor);
  } catch (erro) {
    registrar('warn', 'storage.escrita_falhou', { chave, ...descreverErro(erro) });
  }
}

/** Garante um volume inteiro dentro da faixa; lixo no storage vira o valor inicial. */
export function normalizarVolume(valor: unknown, inicial: number): number {
  const numero = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  if (typeof numero !== 'number' || !Number.isFinite(numero)) return inicial;
  return Math.round(Math.min(VOLUME_MAXIMO, Math.max(VOLUME_MINIMO, numero)));
}

/**
 * Converte o volume do controle (0–100) em ganho de áudio. O ouvido percebe volume em escala
 * logarítmica: com ganho linear, quase todo o ajuste útil ficaria espremido no começo da barra.
 */
export function volumeParaGanho(volume: number): number {
  const fracao = normalizarVolume(volume, VOLUME_MINIMO) / VOLUME_MAXIMO;
  return fracao * fracao;
}

// Vivem no módulo para o menu, a mesa e a música enxergarem os mesmos valores, mesmo sem o storage.
let somLigado = lerTexto(CHAVE_SOM) !== VALOR_DESLIGADO;
let volumeMusica = normalizarVolume(lerTexto(CHAVE_VOLUME_MUSICA), VOLUME_INICIAL_MUSICA);
let volumeEfeitos = normalizarVolume(lerTexto(CHAVE_VOLUME_EFEITOS), VOLUME_INICIAL_EFEITOS);
let volumeReacoes = normalizarVolume(lerTexto(CHAVE_VOLUME_REACOES), VOLUME_INICIAL_REACOES);
const ouvintes = new Set<() => void>();

function avisarOuvintes(): void {
  ouvintes.forEach((ouvinte) => ouvinte());
}

export function somEstaLigado(): boolean {
  return somLigado;
}

export function definirSomLigado(ligado: boolean): void {
  somLigado = ligado;
  gravarTexto(CHAVE_SOM, ligado ? null : VALOR_DESLIGADO);
  avisarOuvintes();
}

export function obterVolumeMusica(): number {
  return volumeMusica;
}

export function definirVolumeMusica(volume: number): void {
  volumeMusica = normalizarVolume(volume, VOLUME_INICIAL_MUSICA);
  gravarTexto(CHAVE_VOLUME_MUSICA, String(volumeMusica));
  avisarOuvintes();
}

export function obterVolumeEfeitos(): number {
  return volumeEfeitos;
}

export function definirVolumeEfeitos(volume: number): void {
  volumeEfeitos = normalizarVolume(volume, VOLUME_INICIAL_EFEITOS);
  gravarTexto(CHAVE_VOLUME_EFEITOS, String(volumeEfeitos));
  avisarOuvintes();
}

export function obterVolumeReacoes(): number {
  return volumeReacoes;
}

export function definirVolumeReacoes(volume: number): void {
  volumeReacoes = normalizarVolume(volume, VOLUME_INICIAL_REACOES);
  gravarTexto(CHAVE_VOLUME_REACOES, String(volumeReacoes));
  avisarOuvintes();
}

/** Assinatura fora do React: a música reage às preferências sem depender de componente montado. */
export function assinarPreferencias(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function useSomLigado(): boolean {
  return useSyncExternalStore(assinarPreferencias, somEstaLigado);
}

export function useVolumeMusica(): number {
  return useSyncExternalStore(assinarPreferencias, obterVolumeMusica);
}

export function useVolumeEfeitos(): number {
  return useSyncExternalStore(assinarPreferencias, obterVolumeEfeitos);
}

export function useVolumeReacoes(): number {
  return useSyncExternalStore(assinarPreferencias, obterVolumeReacoes);
}
