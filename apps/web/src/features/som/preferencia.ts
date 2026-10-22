import { declararPreferencia, type Preferencia } from '../../lib/preferencia';

const VALOR_DESLIGADO = 'off';

export const VOLUME_MINIMO = 0;
export const VOLUME_MAXIMO = 100;
/** Todo som começa no meio para não incomodar quem abre o jogo; cada um sobe no menu se quiser. */
const VOLUME_INICIAL = 50;

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

// Ligado é o normal: só o mudo fica gravado.
export const somLigado = declararPreferencia<boolean>({
  chave: 'fodinha:som',
  padrao: true,
  decodificar: (bruto) => bruto !== VALOR_DESLIGADO,
  codificar: (ligado) => (ligado ? null : VALOR_DESLIGADO),
});

function declararVolume(chave: string): Preferencia<number> {
  return declararPreferencia({
    chave,
    padrao: VOLUME_INICIAL,
    decodificar: (bruto) => normalizarVolume(bruto, VOLUME_INICIAL),
    codificar: (volume) => String(normalizarVolume(volume, VOLUME_INICIAL)),
  });
}

export const volumeDaMusica = declararVolume('fodinha:volume-musica');
export const volumeDosEfeitos = declararVolume('fodinha:volume-efeitos');
export const volumeDasReacoes = declararVolume('fodinha:volume-reacoes');

export const somEstaLigado = somLigado.obter;

const PREFERENCIAS_DO_SOM = [somLigado, volumeDaMusica, volumeDosEfeitos, volumeDasReacoes];

/** Assinatura fora do React: a música reage às preferências sem depender de componente montado. */
export function assinarPreferencias(ouvinte: () => void): () => void {
  const cancelamentos = PREFERENCIAS_DO_SOM.map((preferencia) => preferencia.assinar(ouvinte));
  return () => cancelamentos.forEach((cancelar) => cancelar());
}
