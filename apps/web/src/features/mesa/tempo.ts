const SEGUNDOS_POR_MINUTO = 60;
const MS_POR_SEGUNDO = 1000;

/** Formata uma duração em milissegundos como m:ss (ex.: 0:24). */
export function formatarDuracao(ms: number): string {
  const totalSegundos = Math.max(0, Math.floor(ms / MS_POR_SEGUNDO));
  const minutos = Math.floor(totalSegundos / SEGUNDOS_POR_MINUTO);
  const segundos = totalSegundos % SEGUNDOS_POR_MINUTO;
  return `${minutos}:${String(segundos).padStart(2, '0')}`;
}
